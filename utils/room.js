const Room = require("../models/Room");

function buildDirectKey(userIdA, userIdB) {
  return [String(userIdA), String(userIdB)].sort().join(":");
}

async function ensureDirectRoomForUsers(userIdA, userIdB) {
  const directKey = buildDirectKey(userIdA, userIdB);
  let room = await Room.findOne({ type: "direct", directKey });
  if (room) {
    return room;
  }

  try {
    room = await Room.create({
      name: "Direct chat",
      type: "direct",
      directKey,
      members: [
        { userId: userIdA, role: "member" },
        { userId: userIdB, role: "member" },
      ],
      createdBy: userIdA,
    });
    return room;
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await Room.findOne({ type: "direct", directKey });
      if (existing) return existing;
    }
    throw error;
  }
}

module.exports = {
  buildDirectKey,
  ensureDirectRoomForUsers,
};
