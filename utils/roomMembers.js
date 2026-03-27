/** Helpers dùng chung cho room membership và emit Socket.IO tới từng thành viên. */

function hasMember(room, userId) {
  const uid = String(userId);
  return room.members.some((member) => {
    if (member.userId) {
      return member.userId.toString() === uid;
    }
    return member.toString() === uid;
  });
}

function emitToRoomMembers(io, room, event, payload) {
  const ids = new Set();
  for (const member of room.members) {
    const u = member.userId;
    const mid =
      u == null ? "" : typeof u === "object" && u._id != null ? String(u._id) : String(u);
    if (mid) ids.add(mid);
  }
  for (const mid of ids) {
    io.to(`user:${mid}`).emit(event, payload);
  }
}

module.exports = { hasMember, emitToRoomMembers };
