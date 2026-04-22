const User = require("../models/User");
const { verifyAccessToken } = require("../utils/token");
const { sendError } = require("../utils/apiError");
const { ACCESS_COOKIE } = require("../utils/authCookies");

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");
  const cookieToken = req.cookies?.[ACCESS_COOKIE];
  const bearerToken = scheme === "Bearer" && token ? token : "";
  const accessToken = bearerToken || cookieToken;

  if (!accessToken) {
    return sendError(res, 401, "UNAUTHORIZED", "Chua dang nhap");
  }

  try {
    const payload = verifyAccessToken(accessToken);
    const user = await User.findById(payload.userId).select("-passwordHash");
    if (!user) {
      return sendError(res, 401, "USER_NOT_FOUND", "Tai khoan khong ton tai");
    }

    req.user = user;
    next();
  } catch (_error) {
    return sendError(res, 401, "INVALID_TOKEN", "Token khong hop le hoac het han");
  }
}

module.exports = { requireAuth };
