function formatMessageDoc(item) {
  const sid = item.senderId;
  let senderIdStr = "";
  let username = "Unknown";
  if (sid && typeof sid === "object" && sid._id != null) {
    senderIdStr = sid._id.toString();
    username = sid.username || "Unknown";
  } else if (sid != null) {
    senderIdStr = String(sid);
  }

  const deleted = Boolean(item.deletedAt);
  return {
    id: item._id.toString(),
    roomId: item.roomId.toString(),
    contentType: deleted ? "text" : item.contentType || "text",
    text: deleted ? "Tin nhan da duoc thu hoi" : item.text != null ? String(item.text) : "",
    mediaUrl: deleted ? "" : item.mediaUrl ? String(item.mediaUrl) : "",
    createdAt: item.createdAt,
    deleted,
    sender: {
      id: senderIdStr,
      username,
    },
  };
}

module.exports = { formatMessageDoc };
