const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Room = require("../models/Room");
const { sendError } = require("../utils/apiError");
const { selfUserPayload } = require("../utils/userPublic");
const { hasMember } = require("../utils/roomMembers");
const { escapeRegex } = require("../utils/escapeRegex");

async function searchUsers(req, res) {
  const q = String(req.query.q || "").trim();
  if (!q) {
    return res.json({ users: [] });
  }
  const safeQuery = escapeRegex(q);

  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [
      { username: { $regex: safeQuery, $options: "i" } },
      { email: { $regex: safeQuery, $options: "i" } },
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

async function updateMyProfile(req, res) {
  const { username, email, phone } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay tai khoan");
  }

  const nextUsername = String(username).trim();
  const nextEmail = String(email).toLowerCase().trim();
  const nextPhone = phone != null ? String(phone).trim().slice(0, 24) : "";

  const nameTaken = await User.findOne({
    username: nextUsername,
    _id: { $ne: user._id },
  }).lean();
  if (nameTaken) {
    return sendError(res, 409, "USERNAME_TAKEN", "Ten dang nhap da duoc su dung");
  }

  const emailTaken = await User.findOne({
    email: nextEmail,
    _id: { $ne: user._id },
  }).lean();
  if (emailTaken) {
    return sendError(res, 409, "EMAIL_TAKEN", "Email da duoc su dung");
  }

  user.username = nextUsername;
  user.email = nextEmail;
  user.phone = nextPhone;
  await user.save();

  return res.json({ user: selfUserPayload(user) });
}

async function changeMyPassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay tai khoan");
  }

  const ok = await user.comparePassword(currentPassword);
  if (!ok) {
    return sendError(res, 403, "WRONG_PASSWORD", "Mat khau hien tai khong dung");
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  return res.json({ message: "Da doi mat khau" });
}

async function updateMyAvatar(req, res) {
  const { avatar } = req.body;
  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay tai khoan");
  }

  user.avatar = String(avatar).trim().slice(0, 500);
  await user.save();

  return res.json({ user: selfUserPayload(user) });
}

async function patchChatRoomPrefs(req, res) {
  const { roomId, muted, sidebarPinned } = req.body;

  const room = await Room.findById(roomId).select("members");
  if (!room || !hasMember(room, req.user.id)) {
    return sendError(res, 403, "FORBIDDEN", "Ban khong la thanh vien room");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay tai khoan");
  }

  if (!Array.isArray(user.chatRoomPrefs)) {
    user.chatRoomPrefs = [];
  }

  const rid = roomId.toString();
  const idx = user.chatRoomPrefs.findIndex((p) => p.roomId.toString() === rid);
  if (idx >= 0) {
    if (muted !== undefined) user.chatRoomPrefs[idx].muted = Boolean(muted);
    if (sidebarPinned !== undefined) user.chatRoomPrefs[idx].sidebarPinned = Boolean(sidebarPinned);
  } else {
    user.chatRoomPrefs.push({
      roomId: new mongoose.Types.ObjectId(roomId),
      muted: muted !== undefined ? Boolean(muted) : false,
      sidebarPinned: sidebarPinned !== undefined ? Boolean(sidebarPinned) : false,
    });
  }

  await user.save();
  return res.json({ user: selfUserPayload(user) });
}

module.exports = {
  searchUsers,
  browseUsers,
  updateMyProfile,
  changeMyPassword,
  updateMyAvatar,
  patchChatRoomPrefs,
};
