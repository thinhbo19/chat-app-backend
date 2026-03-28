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
  const rawReactions = Array.isArray(item.reactions) ? item.reactions : [];
  const reactions = deleted
    ? []
    : rawReactions.map((r) => {
        const uid = r.userId;
        let userIdStr = "";
        let reactUsername = "Unknown";
        if (uid && typeof uid === "object" && uid._id != null) {
          userIdStr = uid._id.toString();
          reactUsername = uid.username || "Unknown";
        } else if (uid != null) {
          userIdStr = String(uid);
        }
        return {
          userId: userIdStr,
          username: reactUsername,
          emoji: String(r.emoji || "").trim(),
        };
      });

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
    reactions,
  };
}

module.exports = { formatMessageDoc };
