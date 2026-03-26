const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { sendError } = require("../utils/apiError");

const uploadsDir = path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || "").slice(0, 12).toLowerCase();
    const base = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
    cb(null, `${base}${ext || ""}`);
  },
});

function fileFilter(_req, file, cb) {
  const ok =
    String(file.mimetype || "").startsWith("image/") ||
    String(file.mimetype || "").startsWith("video/") ||
    String(file.mimetype || "").startsWith("audio/");
  cb(null, ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 },
});

function uploadSingleWithErrorHandling(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const msg =
        err.code === "LIMIT_FILE_SIZE" ? "File qua lon (toi da 30MB)" : err.message;
      return sendError(res, 400, "UPLOAD_ERROR", msg);
    }
    return next(err);
  });
}

module.exports = { uploadSingleWithErrorHandling };
