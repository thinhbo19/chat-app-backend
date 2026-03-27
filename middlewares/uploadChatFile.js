const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { sendError } = require("../utils/apiError");

const uploadsDir = path.join(__dirname, "..", "uploads");

const maxMbRaw = Number(process.env.UPLOAD_MAX_MB);
const maxMb = Number.isFinite(maxMbRaw) && maxMbRaw > 0 ? maxMbRaw : 25;
const maxBytes = Math.floor(maxMb * 1024 * 1024);

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/"];

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
  const mt = String(file.mimetype || "");
  const ok = ALLOWED_MIME_PREFIXES.some((p) => mt.startsWith(p));
  cb(null, ok);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: maxBytes, files: 1 },
});

function uploadSingleWithErrorHandling(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      let msg = err.message;
      if (err.code === "LIMIT_FILE_SIZE") {
        msg = `File quá lớn (tối đa ${maxMb}MB)`;
      } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
        msg = "Chỉ gửi một file trong trường 'file'";
      }
      return sendError(res, 400, "UPLOAD_ERROR", msg);
    }
    return next(err);
  });
}

module.exports = {
  uploadSingleWithErrorHandling,
  maxUploadBytes: maxBytes,
  maxUploadMb: maxMb,
};
