const ACCESS_COOKIE = "chat_access_token";
const REFRESH_COOKIE = "chat_refresh_token";

function parseCookieHeader(headerValue) {
  const out = {};
  const raw = String(headerValue || "");
  if (!raw) return out;
  const parts = raw.split(";");
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    out[key] = decodeURIComponent(value);
  }
  return out;
}

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
  };
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  parseCookieHeader,
  cookieOptions,
};
