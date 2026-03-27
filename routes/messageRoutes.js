const express = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { messageUploadLimiter } = require("../middlewares/rateLimit");
const { uploadSingleWithErrorHandling } = require("../middlewares/uploadChatFile");
const { uploadChatMedia } = require("../controllers/messageUploadController");

const router = express.Router();

router.post(
  "/upload",
  requireAuth,
  messageUploadLimiter,
  uploadSingleWithErrorHandling,
  uploadChatMedia,
);

module.exports = router;
