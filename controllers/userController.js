const mongoose = require("mongoose");
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

/** Danh sách người dùng (trừ bản thân), phân trang theo _id tăng dần — `after` = _id bản ghi cuối trang trước. */
async function browseUsers(req, res) {
  const rawLimit = parseInt(String(req.query.limit || "40"), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 40;
  const after = req.query.after ? String(req.query.after).trim() : "";

  const selfId = req.user._id;
  const filter = { $and: [{ _id: { $ne: selfId } }] };
  if (after && mongoose.Types.ObjectId.isValid(after)) {
    filter.$and.push({ _id: { $gt: new mongoose.Types.ObjectId(after) } });
  }

  const rows = await User.find(filter)
    .select("username email avatar status lastSeenAt")
    .sort({ _id: 1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && slice.length > 0 ? String(slice[slice.length - 1]._id) : null;

  return res.json({ users: slice, nextCursor });
}

module.exports = { searchUsers, browseUsers };
