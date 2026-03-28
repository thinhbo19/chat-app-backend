/** Tránh ReDoS / ký tự đặc biệt khi dùng trong RegExp. */
function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { escapeRegex };
