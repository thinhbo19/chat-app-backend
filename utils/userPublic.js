/** Dữ liệu user trả về client (không có passwordHash). */
function publicUserPayload(user) {
  return {
    _id: user._id,
    id: user._id,
    username: user.username,
    email: user.email,
    avatar: user.avatar || "",
    phone: user.phone || "",
    status: user.status,
    lastSeenAt: user.lastSeenAt,
  };
}

module.exports = { publicUserPayload };
