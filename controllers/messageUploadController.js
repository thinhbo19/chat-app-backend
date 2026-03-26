const fs = require("fs");
const { sendError } = require("../utils/apiError");

function detectContentType(mimetype) {
  const mt = String(mimetype || "");
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  return null;
}

async function uploadChatMedia(req, res) {
  if (!req.file) {
    return sendError(res, 400, "NO_FILE", "Chua chon file");
  }

  const contentType = detectContentType(req.file.mimetype);
  if (!contentType) {
    fs.unlink(req.file.path, () => {});
    return sendError(res, 400, "UNSUPPORTED_TYPE", "Dinh dang file khong ho tro");
  }

  const mediaUrl = `/uploads/${req.file.filename}`;
  return res.json({ mediaUrl, contentType });
}

module.exports = { uploadChatMedia };
