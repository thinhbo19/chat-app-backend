const mongoose = require("mongoose");
const Message = require("../models/Message");
const Room = require("../models/Room");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const { formatMessageDoc } = require("../utils/formatChatMessage");
const { markRoomReadAndBroadcast } = require("../services/roomReadService");
const { invalidateUsersChatCache, invalidateUserChatCache } = require("../utils/chatCache");

const userSocketCounts = new Map();

function isRoomMember(room, userId) {
  return room.members.some((member) => {
    if (member.userId) {
      return member.userId.toString() === userId;
    }
    return member.toString() === userId;
  });
}

/** Chuỗi userId từ phần tử members (subdoc, ObjectId, hoặc populate). */
function memberUserIdString(member) {
  if (member == null) return "";
  if (member.userId != null) {
    const u = member.userId;
    if (typeof u === "object" && u._id != null) return String(u._id);
    return String(u);
  }
  return String(member);
}

async function getFriendUserIds(userId) {
  const uid = userId.toString();
  const reqs = await FriendRequest.find({
    status: "accepted",
    $or: [{ fromUserId: userId }, { toUserId: userId }],
  }).lean();
  return reqs.map((r) =>
    r.fromUserId.toString() === uid ? r.toUserId.toString() : r.fromUserId.toString(),
  );
}

/** Mọi userId cần nhận cập nhật presence (bạn bè + mọi thành viên cùng phòng nhóm / direct). */
async function getPresenceSubscriberIds(userId) {
  const self = userId.toString();
  const friendIds = await getFriendUserIds(userId);
  const oid = new mongoose.Types.ObjectId(self);
  const rooms = await Room.find({
    $or: [{ "members.userId": oid }, { members: oid }],
  })
    .select("members")
    .lean();

  const ids = new Set(friendIds);
  for (const room of rooms) {
    for (const m of room.members || []) {
      const mid = memberUserIdString(m);
      if (mid && mid !== self) ids.add(mid);
    }
  }
  return [...ids];
}

async function broadcastStatus(io, userId, status) {
  const now = new Date();
  const update =
    status === "offline"
      ? { status, lastSeenAt: now }
      : { status };
  await User.updateOne({ _id: userId }, update);
  const subscriberIds = await getPresenceSubscriberIds(userId);
  const payload = {
    userId: userId.toString(),
    status,
    ...(status === "offline" ? { lastSeenAt: now.toISOString() } : {}),
  };
  for (const fid of subscriberIds) {
    io.to(`user:${fid}`).emit("user_status", payload);
  }
}

function registerChatSocket(io) {
  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);

    const key = userId.toString();
    const n = (userSocketCounts.get(key) || 0) + 1;
    userSocketCounts.set(key, n);
    if (n === 1) {
      broadcastStatus(io, userId, "online").catch(() => null);
    }

    socket.on("join_room", async (payload, callback) => {
      const roomId = String(payload?.roomId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        callback?.({ ok: false, error: "Invalid roomId" });
        return;
      }

      const room = await Room.findById(roomId);
      if (!room) {
        callback?.({ ok: false, error: "Room not found" });
        return;
      }

      const isMember = isRoomMember(room, userId);
      if (!isMember) {
        callback?.({ ok: false, error: "You are not a member of this room" });
        return;
      }

      socket.data.currentRoomId = roomId;
      socket.join(roomId);
      socket.to(roomId).emit("system_message", `${socket.data.username} joined room`);
      callback?.({ ok: true });
    });

    socket.on("send_message", async (payload, callback) => {
      const roomId = String(payload?.roomId || socket.data.currentRoomId || "").trim();
      const contentType = ["text", "image", "video", "audio"].includes(payload?.contentType)
        ? payload.contentType
        : "text";
      let text = String(payload?.text ?? "").trim();
      if (text.length > 2000) {
        text = text.slice(0, 2000);
      }
      const mediaUrl = String(payload?.mediaUrl ?? "").trim();

      function isAllowedMediaUrl(url) {
        return typeof url === "string" && /^\/uploads\/[A-Za-z0-9._-]+$/.test(url);
      }

      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        callback?.({ ok: false, error: "Invalid roomId" });
        return;
      }

      if (contentType === "text") {
        if (!text) {
          callback?.({ ok: false, error: "Message is empty" });
          return;
        }
      } else if (!isAllowedMediaUrl(mediaUrl)) {
        callback?.({ ok: false, error: "Invalid or missing media" });
        return;
      }

      const room = await Room.findById(roomId).select("members");
      if (!room) {
        callback?.({ ok: false, error: "Room not found" });
        return;
      }
      const isMember = isRoomMember(room, userId);
      if (!isMember) {
        callback?.({ ok: false, error: "You are not a member of this room" });
        return;
      }

      const savedMessage = await Message.create({
        roomId,
        senderId: userId,
        contentType,
        text,
        mediaUrl: ["image", "video", "audio"].includes(contentType) ? mediaUrl : "",
      });

      const message = formatMessageDoc({
        _id: savedMessage._id,
        roomId: savedMessage.roomId,
        contentType: savedMessage.contentType,
        text: savedMessage.text,
        mediaUrl: savedMessage.mediaUrl,
        createdAt: savedMessage.createdAt,
        deletedAt: savedMessage.deletedAt,
        senderId: { _id: userId, username: socket.data.username },
      });

      const recipientIds = new Set();
      for (const member of room.members) {
        const mid = memberUserIdString(member);
        if (mid) recipientIds.add(mid);
      }
      for (const mid of recipientIds) {
        io.to(`user:${mid}`).emit("receive_message", message);
        io.to(`user:${mid}`).emit("room_list_changed");
      }
      await invalidateUsersChatCache([...recipientIds]);
      callback?.({ ok: true });
    });

    socket.on("mark_room_read", async (payload, callback) => {
      const roomId = String(payload?.roomId || "").trim();
      const messageId = payload?.messageId;
      if (!mongoose.Types.ObjectId.isValid(roomId)) {
        callback?.({ ok: false, error: "Invalid roomId" });
        return;
      }
      const result = await markRoomReadAndBroadcast(io, {
        roomId,
        userIdStr: userId.toString(),
        messageId,
      });
      if (!result.ok) {
        callback?.({ ok: false, error: result.error || "mark_room_read failed" });
        return;
      }
      await invalidateUserChatCache(userId.toString());
      callback?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const c = (userSocketCounts.get(key) || 0) - 1;
      if (c <= 0) {
        userSocketCounts.delete(key);
        broadcastStatus(io, userId, "offline").catch(() => null);
      } else {
        userSocketCounts.set(key, c);
      }
    });
  });
}

module.exports = { registerChatSocket };
