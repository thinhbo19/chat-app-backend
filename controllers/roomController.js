const mongoose = require("mongoose");
const Room = require("../models/Room");
const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const { ensureDirectRoomForUsers } = require("../utils/room");
const Message = require("../models/Message");
const RoomReadState = require("../models/RoomReadState");
const { formatMessageDoc } = require("../utils/formatChatMessage");
const { sendError } = require("../utils/apiError");

function hasMember(room, userId) {
  return room.members.some((member) => {
    if (member.userId) {
      return member.userId.toString() === userId;
    }
    return member.toString() === userId;
  });
}

function emitToRoomMembers(io, room, event, payload) {
  const ids = new Set();
  for (const member of room.members) {
    const u = member.userId;
    const mid = u == null ? "" : typeof u === "object" && u._id != null ? String(u._id) : String(u);
    if (mid) ids.add(mid);
  }
  for (const mid of ids) {
    io.to(`user:${mid}`).emit(event, payload);
  }
}

async function createRoom(req, res) {
  const { name, memberIds } = req.body;

  const memberObjectIds = Array.isArray(memberIds)
    ? memberIds
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id))
    : [];

  const ownerId = req.user._id;
  const membersSet = new Set([ownerId.toString(), ...memberObjectIds.map(String)]);
  const members = Array.from(membersSet).map((id) => ({
    userId: new mongoose.Types.ObjectId(id),
    role: id === ownerId.toString() ? "owner" : "member",
  }));

  const room = await Room.create({
    name: String(name).trim(),
    type: "group",
    members,
    createdBy: ownerId,
  });

  return res.status(201).json({ room });
}

async function getMyRooms(req, res) {
  const rooms = await Room.find({
    $or: [{ "members.userId": req.user._id }, { members: req.user._id }],
  })
    .sort({ updatedAt: -1 })
    .populate("members.userId", "username email avatar status lastSeenAt");
  return res.json({ rooms });
}

async function getUnreadSummary(req, res) {
  const userId = req.user._id;
  const roomDocs = await Room.find({
    $or: [{ "members.userId": userId }, { members: userId }],
  })
    .select("_id")
    .lean();

  const counts = {};
  for (const room of roomDocs) {
    const rid = room._id;
    const state = await RoomReadState.findOne({ roomId: rid, userId }).lean();
    const afterId = state?.lastReadMessageId;
    const filter = {
      roomId: rid,
      senderId: { $ne: userId },
      deletedAt: null,
    };
    if (afterId) {
      filter._id = { $gt: afterId };
    }
    const n = await Message.countDocuments(filter);
    counts[rid.toString()] = Math.min(n, 999);
  }

  return res.json({ counts });
}

async function joinRoom(req, res) {
  const { roomId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return sendError(res, 400, "INVALID_ROOM_ID", "Room ID khong hop le");
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }

  const exists = hasMember(room, req.user.id);
  if (!exists) {
    room.members.push({ userId: req.user._id, role: "member" });
    await room.save();
  }

  return res.json({ room });
}

async function updateMemberRole(req, res) {
  const { roomId, memberUserId } = req.params;
  const { role } = req.body;

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi ap dung cho nhom");
  }

  const me = room.members.find((member) => member.userId.toString() === req.user.id);
  if (!me || me.role !== "owner") {
    return sendError(res, 403, "FORBIDDEN", "Chi chu nhom moi doi duoc vai tro");
  }
  if (memberUserId === req.user.id) {
    return sendError(res, 400, "INVALID_TARGET", "Khong doi duoc vai tro chu nhom");
  }

  const target = room.members.find((member) => member.userId.toString() === memberUserId);
  if (!target) {
    return sendError(res, 404, "MEMBER_NOT_FOUND", "Khong tim thay thanh vien");
  }

  target.role = role;
  await room.save();
  return res.json({ message: "Member role updated", room });
}

async function addMemberToGroup(req, res) {
  const { roomId } = req.params;
  const { memberUserId } = req.body;

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi nhom moi them duoc thanh vien");
  }

  const me = room.members.find((member) => member.userId.toString() === req.user.id);
  if (!me) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong o trong room nay");
  }
  if (!["owner", "admin"].includes(me.role)) {
    return sendError(res, 403, "FORBIDDEN", "Chi chu nhom / admin moi them thanh vien");
  }

  if (memberUserId === req.user.id) {
    return sendError(res, 400, "INVALID_TARGET", "Ban da o trong nhom");
  }

  const targetUser = await User.findById(memberUserId).select("_id");
  if (!targetUser) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay nguoi dung");
  }

  const exists = room.members.some((member) => member.userId.toString() === memberUserId);
  if (exists) {
    return sendError(res, 409, "ALREADY_MEMBER", "Nguoi nay da trong nhom");
  }

  const isFriend = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { fromUserId: req.user.id, toUserId: memberUserId },
      { fromUserId: memberUserId, toUserId: req.user.id },
    ],
  }).lean();
  if (!isFriend) {
    return sendError(res, 403, "NOT_FRIEND", "Chi them duoc ban be trong danh sach");
  }

  room.members.push({ userId: memberUserId, role: "member" });
  await room.save();

  const io = req.app.get("io");
  io.to(`user:${memberUserId}`).emit("room_list_changed", {
    roomId: room._id.toString(),
  });
  room.members.forEach((member) => {
    io.to(`user:${member.userId.toString()}`).emit("room_list_changed", {
      roomId: room._id.toString(),
    });
  });

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  return res.json({ message: "Member added successfully", room: populatedRoom });
}

async function getRoomMessages(req, res) {
  const { roomId } = req.params;
  const limitRaw = req.query.limit != null ? Number(req.query.limit) : 50;
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 50));
  const { before } = req.query;

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }

  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  const filter = { roomId };
  if (before && mongoose.Types.ObjectId.isValid(String(before))) {
    filter._id = { $lt: new mongoose.Types.ObjectId(String(before)) };
  }

  const docs = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(limit)
    .populate("senderId", "username")
    .lean();

  const messages = docs.reverse().map((item) => formatMessageDoc(item));
  const hasMore = docs.length === limit;

  return res.json({ messages, hasMore });
}

async function deleteRoomMessage(req, res) {
  const { roomId, messageId } = req.params;

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  const msg = await Message.findOne({ _id: messageId, roomId });
  if (!msg) {
    return sendError(res, 404, "MESSAGE_NOT_FOUND", "Khong tim thay tin nhan");
  }
  if (msg.senderId.toString() !== req.user.id) {
    return sendError(res, 403, "FORBIDDEN", "Chi nguoi gui moi thu hoi duoc");
  }
  if (msg.deletedAt) {
    return sendError(res, 400, "ALREADY_DELETED", "Tin nhan da bi thu hoi");
  }

  msg.deletedAt = new Date();
  await msg.save();

  const populated = await Message.findById(msg._id).populate("senderId", "username").lean();
  const formatted = formatMessageDoc(populated);

  const io = req.app.get("io");
  emitToRoomMembers(io, room, "message_updated", formatted);

  return res.json({ message: formatted });
}

async function markRoomRead(req, res) {
  const { roomId } = req.params;
  const { messageId } = req.body;

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
    return sendError(res, 400, "INVALID_MESSAGE_ID", "Message ID khong hop le");
  }

  const msgExists = await Message.exists({ _id: messageId, roomId });
  if (!msgExists) {
    return sendError(res, 404, "MESSAGE_NOT_FOUND", "Khong tim thay tin nhan trong room");
  }

  const lastReadAt = new Date();
  await RoomReadState.findOneAndUpdate(
    { roomId, userId: req.user._id },
    {
      lastReadMessageId: messageId,
      lastReadAt,
    },
    { upsert: true, new: true },
  );

  const io = req.app.get("io");
  emitToRoomMembers(io, room, "read_receipt", {
    roomId,
    userId: req.user.id,
    messageId: String(messageId),
    lastReadAt: lastReadAt.toISOString(),
  });

  return res.json({ ok: true });
}

async function getRoomReadStates(req, res) {
  const { roomId } = req.params;

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  const states = await RoomReadState.find({ roomId }).lean();
  const formatted = states.map((s) => ({
    userId: s.userId.toString(),
    lastReadMessageId: s.lastReadMessageId ? s.lastReadMessageId.toString() : null,
    lastReadAt: s.lastReadAt,
  }));

  return res.json({ states: formatted });
}

async function getOrCreateDirectRoom(req, res) {
  const { friendUserId } = req.params;
  if (friendUserId === req.user.id) {
    return sendError(res, 400, "INVALID_TARGET", "Khong the chat voi chinh minh");
  }

  const isFriend = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { fromUserId: req.user.id, toUserId: friendUserId },
      { fromUserId: friendUserId, toUserId: req.user.id },
    ],
  }).lean();

  if (!isFriend) {
    return sendError(res, 403, "NOT_FRIEND", "Chi chat truc tiep voi ban be");
  }

  const room = await ensureDirectRoomForUsers(req.user.id, friendUserId);
  return res.json({ room });
}

module.exports = {
  createRoom,
  getMyRooms,
  getUnreadSummary,
  joinRoom,
  updateMemberRole,
  addMemberToGroup,
  getOrCreateDirectRoom,
  getRoomMessages,
  deleteRoomMessage,
  markRoomRead,
  getRoomReadStates,
};
