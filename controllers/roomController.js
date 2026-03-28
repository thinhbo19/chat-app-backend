const mongoose = require("mongoose");
const Room = require("../models/Room");
const FriendRequest = require("../models/FriendRequest");
const GroupInvite = require("../models/GroupInvite");
const User = require("../models/User");
const { ensureDirectRoomForUsers } = require("../utils/room");
const Message = require("../models/Message");
const RoomReadState = require("../models/RoomReadState");
const { formatMessageDoc } = require("../utils/formatChatMessage");
const { sendError } = require("../utils/apiError");
const { hasMember, emitToRoomMembers } = require("../utils/roomMembers");
const { markRoomReadAndBroadcast } = require("../services/roomReadService");
const { escapeRegex } = require("../utils/escapeRegex");

const MAX_PINNED_MESSAGES_PER_ROOM = 3;

async function createRoom(req, res) {
  const { name, memberIds, avatar } = req.body;

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
    avatar: typeof avatar === "string" ? avatar.trim().slice(0, 500) : "",
    type: "group",
    members,
    createdBy: ownerId,
  });

  const populated = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  return res.status(201).json({ room: populated });
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

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  const io = req.app.get("io");
  if (io) {
    populatedRoom.members.forEach((member) => {
      io.to(`user:${member.userId._id.toString()}`).emit("room_list_changed", {
        roomId: room._id.toString(),
      });
    });
  }

  return res.json({ message: "Member role updated", room: populatedRoom });
}

async function updateGroupRoom(req, res) {
  const { roomId } = req.params;
  const { name, avatar } = req.body;

  if (!mongoose.Types.ObjectId.isValid(roomId)) {
    return sendError(res, 400, "INVALID_ROOM_ID", "Room ID khong hop le");
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi ap dung cho nhom");
  }

  const me = room.members.find((member) => member.userId.toString() === req.user.id);
  if (!me) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong o trong room nay");
  }

  if (name !== undefined) {
    if (!["owner", "admin"].includes(me.role)) {
      return sendError(
        res,
        403,
        "FORBIDDEN",
        "Chi truong phong / pho phong doi duoc ten phong",
      );
    }
    room.name = String(name).trim();
  }
  if (avatar !== undefined) {
    room.avatar = String(avatar).trim().slice(0, 500);
  }
  await room.save();

  const populated = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  const io = req.app.get("io");
  if (io) {
    populated.members.forEach((member) => {
      io.to(`user:${member.userId._id.toString()}`).emit("room_list_changed", {
        roomId: room._id.toString(),
      });
    });
  }

  return res.json({ room: populated });
}

async function addMemberToGroup(req, res) {
  const { roomId } = req.params;
  const { memberUserId } = req.body;
  const myId = req.user._id;

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi nhom moi them duoc thanh vien");
  }

  const me = room.members.find((member) => member.userId.toString() === myId.toString());
  if (!me) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong o trong room nay");
  }
  if (!["owner", "admin"].includes(me.role)) {
    return sendError(res, 403, "FORBIDDEN", "Chi chu nhom / admin moi them thanh vien");
  }

  if (memberUserId === myId.toString()) {
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
      { fromUserId: myId, toUserId: memberUserId },
      { fromUserId: memberUserId, toUserId: myId },
    ],
  }).lean();
  if (!isFriend) {
    return sendError(res, 403, "NOT_FRIEND", "Chi them duoc ban be trong danh sach");
  }

  const pendingInvite = await GroupInvite.findOne({
    roomId: room._id,
    inviteeUserId: memberUserId,
    status: "pending",
  }).lean();
  if (pendingInvite) {
    return sendError(res, 409, "INVITE_PENDING", "Da gui loi moi, dang cho nguoi nay chap nhan");
  }

  const invite = await GroupInvite.create({
    roomId: room._id,
    inviteeUserId: memberUserId,
    invitedByUserId: myId,
    status: "pending",
  });

  const inviter = await User.findById(myId).select("username").lean();

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${memberUserId}`).emit("group_invite_received", {
      invite: {
        _id: invite._id.toString(),
        roomId: {
          _id: room._id.toString(),
          name: room.name,
          avatar: room.avatar || "",
          type: "group",
        },
        invitedByUserId: {
          _id: myId.toString(),
          username: inviter?.username || "?",
        },
        status: "pending",
        createdAt: invite.createdAt,
      },
    });
  }

  return res.status(201).json({
    message: "Da gui loi moi vao nhom",
    invite: {
      _id: invite._id,
      roomId: room._id,
      inviteeUserId: memberUserId,
    },
  });
}

async function listPendingGroupInvites(req, res) {
  const invites = await GroupInvite.find({
    inviteeUserId: req.user._id,
    status: "pending",
  })
    .populate("roomId", "name avatar type")
    .populate("invitedByUserId", "username email avatar status lastSeenAt")
    .sort({ createdAt: -1 })
    .lean();

  const valid = invites.filter((doc) => doc.roomId && doc.roomId.type === "group");
  return res.json({ invites: valid });
}

async function acceptGroupInvite(req, res) {
  const { inviteId } = req.params;
  const myId = req.user._id;

  const invite = await GroupInvite.findOne({
    _id: inviteId,
    inviteeUserId: myId,
    status: "pending",
  });
  if (!invite) {
    return sendError(res, 404, "INVITE_NOT_FOUND", "Khong tim thay loi moi hoac da xu ly");
  }

  const room = await Room.findById(invite.roomId);
  if (!room || room.type !== "group") {
    invite.status = "declined";
    await invite.save();
    return sendError(res, 404, "ROOM_NOT_FOUND", "Nhom khong con ton tai");
  }

  if (room.members.some((m) => m.userId.toString() === myId.toString())) {
    invite.status = "accepted";
    await invite.save();
    const populatedRoom = await Room.findById(room._id).populate(
      "members.userId",
      "username email avatar status lastSeenAt",
    );
    return res.json({ message: "Ban da o trong nhom", room: populatedRoom, alreadyMember: true });
  }

  room.members.push({ userId: myId, role: "member" });
  await room.save();
  invite.status = "accepted";
  await invite.save();

  const io = req.app.get("io");
  const roomIdStr = room._id.toString();
  const memberIds = room.members.map((m) => m.userId.toString());
  emitRoomListChangedToUsers(io, roomIdStr, memberIds);

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  return res.json({ message: "Da tham gia nhom", room: populatedRoom });
}

async function declineGroupInvite(req, res) {
  const { inviteId } = req.params;
  const myId = req.user._id;

  const invite = await GroupInvite.findOne({
    _id: inviteId,
    inviteeUserId: myId,
    status: "pending",
  });
  if (!invite) {
    return sendError(res, 404, "INVITE_NOT_FOUND", "Khong tim thay loi moi hoac da xu ly");
  }

  invite.status = "declined";
  await invite.save();

  const io = req.app.get("io");
  if (io) {
    io.to(`user:${invite.invitedByUserId.toString()}`).emit("group_invite_updated", {
      inviteId: invite._id.toString(),
      status: "declined",
    });
  }

  return res.json({ ok: true });
}

function emitRoomListChangedToUsers(io, roomIdStr, userIdStrs) {
  if (!io) return;
  const seen = new Set();
  for (const uid of userIdStrs) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    io.to(`user:${uid}`).emit("room_list_changed", { roomId: roomIdStr });
  }
}

async function leaveGroup(req, res) {
  const { roomId } = req.params;
  const { newOwnerUserId } = req.body;

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi ap dung cho nhom");
  }

  const me = room.members.find((member) => member.userId.toString() === req.user.id);
  if (!me) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong o trong room nay");
  }

  const io = req.app.get("io");
  const roomIdStr = room._id.toString();
  const myId = req.user.id;

  if (me.role !== "owner") {
    const beforeIds = room.members.map((m) => m.userId.toString());
    room.members = room.members.filter((m) => m.userId.toString() !== myId);
    await room.save();
    emitRoomListChangedToUsers(io, roomIdStr, [...beforeIds]);
    return res.json({ ok: true });
  }

  if (room.members.length === 1) {
    return sendError(
      res,
      400,
      "SOLE_OWNER",
      "Ban la thanh vien duy nhat. Hay them nguoi khac hoac xoa nhom thay vi roi.",
    );
  }

  if (!newOwnerUserId || !mongoose.Types.ObjectId.isValid(newOwnerUserId)) {
    return sendError(
      res,
      400,
      "TRANSFER_REQUIRED",
      "Truong phong can nhuong quyen cho thanh vien khac truoc khi roi nhom",
    );
  }

  if (newOwnerUserId === myId) {
    return sendError(res, 400, "INVALID_TARGET", "Chon thanh vien khac lam truong phong moi");
  }

  const successor = room.members.find((m) => m.userId.toString() === newOwnerUserId);
  if (!successor) {
    return sendError(res, 400, "NOT_MEMBER", "Nguoi duoc chon khong trong nhom");
  }

  successor.role = "owner";
  room.createdBy = successor.userId;
  room.members = room.members.filter((m) => m.userId.toString() !== myId);
  await room.save();

  const afterIds = room.members.map((m) => m.userId.toString());
  emitRoomListChangedToUsers(io, roomIdStr, [...afterIds, myId]);

  return res.json({ ok: true });
}

async function removeMemberFromGroup(req, res) {
  const { roomId, memberUserId } = req.params;

  if (memberUserId === req.user.id) {
    return sendError(res, 400, "USE_LEAVE", "Dung chuc nang roi nhom de roi chinh ban");
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (room.type !== "group") {
    return sendError(res, 400, "NOT_GROUP_ROOM", "Chi ap dung cho nhom");
  }

  const me = room.members.find((member) => member.userId.toString() === req.user.id);
  if (!me || !["owner", "admin"].includes(me.role)) {
    return sendError(res, 403, "FORBIDDEN", "Chi truong phong / pho phong moi xoa duoc thanh vien");
  }

  const target = room.members.find((m) => m.userId.toString() === memberUserId);
  if (!target) {
    return sendError(res, 404, "MEMBER_NOT_FOUND", "Khong tim thay thanh vien");
  }
  if (target.role === "owner") {
    return sendError(res, 403, "CANNOT_REMOVE_OWNER", "Khong the xoa truong phong khoi nhom");
  }
  if (me.role === "admin" && target.role === "admin") {
    return sendError(
      res,
      403,
      "ADMIN_CANNOT_REMOVE_ADMIN",
      "Pho phong chi co the xoa thanh vien, khong xoa pho phong khac",
    );
  }

  const beforeIds = room.members.map((m) => m.userId.toString());
  room.members = room.members.filter((m) => m.userId.toString() !== memberUserId);
  await room.save();

  const io = req.app.get("io");
  emitRoomListChangedToUsers(io, room._id.toString(), beforeIds);

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  return res.json({ message: "Member removed", room: populatedRoom });
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
    .populate("reactions.userId", "username")
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

  const populated = await Message.findById(msg._id)
    .populate("senderId", "username")
    .populate("reactions.userId", "username")
    .lean();
  const formatted = formatMessageDoc(populated);

  const io = req.app.get("io");
  emitToRoomMembers(io, room, "message_updated", formatted);

  return res.json({ message: formatted });
}

async function toggleMessageReaction(req, res) {
  const { roomId, messageId } = req.params;
  const emoji = String(req.body?.emoji ?? "").trim();
  if (!emoji || emoji.length > 16) {
    return sendError(res, 400, "INVALID_EMOJI", "Emoji khong hop le");
  }

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  const msg = await Message.findOne({ _id: messageId, roomId, deletedAt: null });
  if (!msg) {
    return sendError(res, 404, "MESSAGE_NOT_FOUND", "Khong tim thay tin nhan");
  }

  const uid = req.user._id;
  const list = (msg.reactions || []).map((r) => ({
    userId: r.userId,
    emoji: r.emoji,
  }));
  const i = list.findIndex((r) => r.userId.toString() === uid.toString());
  if (i >= 0 && list[i].emoji === emoji) {
    list.splice(i, 1);
  } else if (i >= 0) {
    list[i] = { userId: uid, emoji };
  } else {
    list.push({ userId: uid, emoji });
  }
  msg.reactions = list;
  await msg.save();

  const populated = await Message.findById(msg._id)
    .populate("senderId", "username")
    .populate("reactions.userId", "username")
    .lean();
  const formatted = formatMessageDoc(populated);
  const io = req.app.get("io");
  emitToRoomMembers(io, room, "message_updated", formatted);
  return res.json({ message: formatted });
}

function canPinInRoom(room, userIdStr) {
  const me = room.members.find((m) => m.userId.toString() === userIdStr);
  if (!me) return false;
  if (room.type === "direct") return true;
  return ["owner", "admin"].includes(me.role);
}

async function pinRoomMessage(req, res) {
  const { roomId } = req.params;
  const messageId = String(req.body?.messageId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(roomId) || !mongoose.Types.ObjectId.isValid(messageId)) {
    return sendError(res, 400, "INVALID_ID", "ID khong hop le");
  }

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }
  if (!canPinInRoom(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Chi chu phong / pho phong moi ghim tin (nhom)");
  }

  const msg = await Message.findOne({ _id: messageId, roomId, deletedAt: null });
  if (!msg) {
    return sendError(res, 404, "MESSAGE_NOT_FOUND", "Khong tim thay tin nhan");
  }

  const pins = (room.pinnedMessageIds || []).map((id) => id.toString());
  if (pins.includes(messageId)) {
    const populated = await Room.findById(room._id).populate(
      "members.userId",
      "username email avatar status lastSeenAt",
    );
    return res.json({
      pinnedMessageIds: pins,
      room: populated,
    });
  }
  if (pins.length >= MAX_PINNED_MESSAGES_PER_ROOM) {
    return sendError(
      res,
      400,
      "PIN_LIMIT",
      `Toi da ${MAX_PINNED_MESSAGES_PER_ROOM} tin ghim`,
    );
  }

  room.pinnedMessageIds = [...(room.pinnedMessageIds || []), new mongoose.Types.ObjectId(messageId)];
  await room.save();

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  const io = req.app.get("io");
  const payload = {
    roomId: room._id.toString(),
    pinnedMessageIds: room.pinnedMessageIds.map((id) => id.toString()),
  };
  if (io) {
    emitToRoomMembers(io, room, "room_pins_updated", payload);
    populatedRoom.members.forEach((member) => {
      const u = member.userId;
      const mid = u && typeof u === "object" && u._id ? u._id.toString() : String(u);
      if (mid) io.to(`user:${mid}`).emit("room_list_changed", { roomId: room._id.toString() });
    });
  }

  return res.json({
    pinnedMessageIds: payload.pinnedMessageIds,
    room: populatedRoom,
  });
}

async function unpinRoomMessage(req, res) {
  const { roomId, messageId } = req.params;

  const room = await Room.findById(roomId);
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }
  if (!canPinInRoom(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Chi chu phong / pho phong moi bo ghim (nhom)");
  }

  room.pinnedMessageIds = (room.pinnedMessageIds || []).filter(
    (id) => id.toString() !== messageId,
  );
  await room.save();

  const populatedRoom = await Room.findById(room._id).populate(
    "members.userId",
    "username email avatar status lastSeenAt",
  );
  const io = req.app.get("io");
  const payload = {
    roomId: room._id.toString(),
    pinnedMessageIds: room.pinnedMessageIds.map((id) => id.toString()),
  };
  if (io) {
    emitToRoomMembers(io, room, "room_pins_updated", payload);
    populatedRoom.members.forEach((member) => {
      const u = member.userId;
      const mid = u && typeof u === "object" && u._id ? u._id.toString() : String(u);
      if (mid) io.to(`user:${mid}`).emit("room_list_changed", { roomId: room._id.toString() });
    });
  }

  return res.json({
    pinnedMessageIds: payload.pinnedMessageIds,
    room: populatedRoom,
  });
}

async function searchRoomMessages(req, res) {
  const { roomId } = req.params;
  const q = String(req.query.q ?? "").trim();
  const limitRaw = req.query.limit != null ? Number(req.query.limit) : 30;
  const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 30));

  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
  }
  if (!hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  if (!q) {
    return res.json({ messages: [] });
  }

  const safe = escapeRegex(q);
  const docs = await Message.find({
    roomId,
    deletedAt: null,
    contentType: "text",
    text: { $regex: safe, $options: "i" },
  })
    .sort({ _id: -1 })
    .limit(limit)
    .populate("senderId", "username")
    .populate("reactions.userId", "username")
    .lean();

  return res.json({
    messages: docs.map((item) => formatMessageDoc(item)),
  });
}

async function markRoomRead(req, res) {
  const { roomId } = req.params;
  const { messageId } = req.body;
  const io = req.app.get("io");
  const result = await markRoomReadAndBroadcast(io, {
    roomId,
    userIdStr: req.user.id,
    messageId,
  });
  if (!result.ok) {
    if (result.error === "Room not found") {
      return sendError(res, 404, "ROOM_NOT_FOUND", "Khong tim thay room");
    }
    if (result.error === "You are not a member of this room") {
      return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
    }
    if (result.error === "Invalid messageId") {
      return sendError(res, 400, "INVALID_MESSAGE_ID", "Message ID khong hop le");
    }
    if (result.error === "Message not found in room") {
      return sendError(res, 404, "MESSAGE_NOT_FOUND", "Khong tim thay tin nhan trong room");
    }
    return sendError(res, 400, "MARK_READ_FAILED", result.error || "Loi cap nhat da doc");
  }
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
  updateGroupRoom,
  updateMemberRole,
  addMemberToGroup,
  listPendingGroupInvites,
  acceptGroupInvite,
  declineGroupInvite,
  leaveGroup,
  removeMemberFromGroup,
  getOrCreateDirectRoom,
  getRoomMessages,
  deleteRoomMessage,
  markRoomRead,
  getRoomReadStates,
  toggleMessageReaction,
  pinRoomMessage,
  unpinRoomMessage,
  searchRoomMessages,
};
