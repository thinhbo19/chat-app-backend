const bcrypt = require("bcryptjs");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const { sendError } = require("../utils/apiError");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} = require("../utils/token");
const { sha256 } = require("../utils/hash");

function parseExpiryToMs(expiry) {
  const match = String(expiry).trim().match(/^(\d+)([mhd])$/i);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "m") return value * 60 * 1000;
  if (unit === "h") return value * 60 * 60 * 1000;
  return value * 24 * 60 * 60 * 1000;
}

async function register(req, res) {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return sendError(res, 400, "MISSING_FIELDS", "Thieu username, email hoac mat khau");
  }
  if (String(password).length < 6) {
    return sendError(res, 400, "WEAK_PASSWORD", "Mat khau can toi thieu 6 ky tu");
  }

  const existing = await User.findOne({
    $or: [{ email: String(email).toLowerCase() }, { username }],
  });
  if (existing) {
    return sendError(res, 409, "DUPLICATE_USER", "Email hoac username da ton tai");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    username: String(username).trim(),
    email: String(email).toLowerCase().trim(),
    passwordHash,
  });

  return res.status(201).json({
    message: "Register success",
    user: {
      _id: user._id,
      id: user._id,
      username: user.username,
      email: user.email,
    },
  });
}

async function login(req, res) {
  const { emailOrUsername, password } = req.body;
  if (!emailOrUsername || !password) {
    return sendError(res, 400, "MISSING_FIELDS", "Thieu ten dang nhap hoac mat khau");
  }

  const query = String(emailOrUsername).includes("@")
    ? { email: String(emailOrUsername).toLowerCase() }
    : { username: String(emailOrUsername) };

  const user = await User.findOne(query);
  if (!user) {
    return sendError(res, 401, "INVALID_CREDENTIALS", "Sai ten dang nhap hoac mat khau");
  }

  const isValidPassword = await user.comparePassword(password);
  if (!isValidPassword) {
    return sendError(res, 401, "INVALID_CREDENTIALS", "Sai ten dang nhap hoac mat khau");
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  const refreshTokenHash = sha256(refreshToken);
  const refreshMs = parseExpiryToMs(process.env.REFRESH_TOKEN_EXPIRES_IN || "7d");

  await RefreshToken.deleteMany({ userId: user._id });
  await RefreshToken.create({
    userId: user._id,
    tokenHash: refreshTokenHash,
    expiresAt: new Date(Date.now() + refreshMs),
  });

  return res.json({
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
    },
  });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return sendError(res, 400, "MISSING_REFRESH", "Thieu refresh token");
  }

  try {
    const payload = verifyRefreshToken(refreshToken);
    const refreshTokenHash = sha256(refreshToken);
    const storedToken = await RefreshToken.findOne({
      tokenHash: refreshTokenHash,
      userId: payload.userId,
      expiresAt: { $gt: new Date() },
    });
    if (!storedToken) {
      return sendError(res, 401, "INVALID_REFRESH", "Refresh token khong hop le");
    }

    const user = await User.findById(payload.userId);
    if (!user) {
      return sendError(res, 401, "USER_NOT_FOUND", "Tai khoan khong ton tai");
    }

    const newAccessToken = signAccessToken(user);
    return res.json({ accessToken: newAccessToken });
  } catch (_error) {
    return sendError(res, 401, "INVALID_REFRESH", "Refresh token khong hop le");
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return sendError(res, 400, "MISSING_REFRESH", "Thieu refresh token");
  }

  const refreshTokenHash = sha256(refreshToken);
  await RefreshToken.deleteOne({ tokenHash: refreshTokenHash });
  return res.json({ message: "Logout success" });
}

async function me(req, res) {
  return res.json({ user: req.user });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
