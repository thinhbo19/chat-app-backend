/** Dữ liệu user trả về client (không có passwordHash). */
function publicUserPayload(user) {
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

module.exports = { publicUserPayload };
