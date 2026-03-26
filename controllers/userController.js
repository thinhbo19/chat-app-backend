const User = require("../models/User");

async function searchUsers(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({ users: [] });
  }

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { username: { $regex: q, $options: "i" } },
      { email: { $regex: q, $options: "i" } },
    ],
  })
    .select("username email avatar status lastSeenAt")
    .limit(20);

  return res.json({ users });
}

module.exports = { searchUsers };
