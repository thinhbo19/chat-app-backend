/** Dữ liệu user an toàn để hiển thị cho người dùng khác (không PII nhạy cảm). */
function publicUserPayload(user) {
  return {
    _id: user._id,
    id: user._id,
    username: user.username,
    avatar: user.avatar || "",
    status: user.status,
    lastSeenAt: user.lastSeenAt,
  };
}

/** Dữ liệu đầy đủ cho chính chủ tài khoản (self endpoints). */
function selfUserPayload(user) {
  const prefs = Array.isArray(user.chatRoomPrefs)
    ? user.chatRoomPrefs.map((p) => ({
        roomId: p.roomId ? p.roomId.toString() : "",
        muted: Boolean(p.muted),
        sidebarPinned: Boolean(p.sidebarPinned),
      }))
    : [];
  return {
    _id: user._id,
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || "",
    phone: user.phone || "",
    status: user.status,
    lastSeenAt: user.lastSeenAt,
    chatRoomPrefs: prefs,
  };
}

module.exports = { publicUserPayload, selfUserPayload };
