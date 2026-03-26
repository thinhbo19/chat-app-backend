const express = require("express");
const { requireAuth } = require("../middlewares/authMiddleware");
const { uploadSingleWithErrorHandling } = require("../middlewares/uploadChatFile");
const { uploadChatMedia } = require("../controllers/messageUploadController");

const router = express.Router();

router.post("/upload", requireAuth, uploadSingleWithErrorHandling, uploadChatMedia);

module.exports = router;
