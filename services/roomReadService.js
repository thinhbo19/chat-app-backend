const mongoose = require("mongoose");
const Room = require("../models/Room");
const Message = require("../models/Message");
const RoomReadState = require("../models/RoomReadState");
const { hasMember, emitToRoomMembers } = require("../utils/roomMembers");

/**
 * Cập nhật trạng thái đã đọc và phát read_receipt tới mọi thành viên phòng.
 * Dùng chung cho HTTP và socket.
 */
async function markRoomReadAndBroadcast(io, { roomId, userIdStr, messageId }) {
  const room = await Room.findById(roomId).select("members");
  if (!room) {
    return { ok: false, error: "Room not found" };
  }
  if (!hasMember(room, userIdStr)) {
    return { ok: false, error: "You are not a member of this room" };
  }

  if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
    return { ok: false, error: "Invalid messageId" };
  }

  const msgExists = await Message.exists({ _id: messageId, roomId });
  if (!msgExists) {
    return { ok: false, error: "Message not found in room" };
  }

  const lastReadAt = new Date();
  const userOid = new mongoose.Types.ObjectId(userIdStr);
  await RoomReadState.findOneAndUpdate(
    { roomId, userId: userOid },
    {
      lastReadMessageId: messageId,
      lastReadAt,
    },
    { upsert: true, returnDocument: "after" },
  );

  emitToRoomMembers(io, room, "read_receipt", {
    roomId: String(roomId),
    userId: userIdStr,
    messageId: String(messageId),
    lastReadAt: lastReadAt.toISOString(),
  });

  return { ok: true };
}

module.exports = { markRoomReadAndBroadcast };
