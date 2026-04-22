const rateLimit = require("express-rate-limit");
const { sendError } = require("../utils/apiError");

function limitHandler(_req, res) {
  return sendError(res, 429, "RATE_LIMIT", "Quá nhiều yêu cầu. Vui lòng thử lại sau.");
}

/** Đăng nhập / đăng ký — chống brute-force */
const authStrictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

/** Refresh token — cho phép hơi dày hơn nhưng vẫn có trần */
const authRefreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

/** Gửi lời mời kết bạn */
const friendRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

/** Upload media chat */
const messageUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

/** Đọc/search dữ liệu chat (messages, room list, read-state) */
const chatReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

/** Tìm kiếm người dùng / browse user */
const userSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

module.exports = {
  authStrictLimiter,
  authRefreshLimiter,
  friendRequestLimiter,
  messageUploadLimiter,
  chatReadLimiter,
  userSearchLimiter,
};
