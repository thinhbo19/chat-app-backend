const express = require("express");
const {
  browseUsers,
  searchUsers,
  updateMyProfile,
  changeMyPassword,
  updateMyAvatar,
  patchChatRoomPrefs,
} = require("../controllers/userController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const {
  browseUsersSchema,
  searchUsersSchema,
  updateMyProfileSchema,
  changeMyPasswordSchema,
  updateMyAvatarSchema,
  patchChatRoomPrefsSchema,
} = require("../schemas/userSchemas");

const router = express.Router();

router.use(requireAuth);
router.patch("/me", validate(updateMyProfileSchema), updateMyProfile);
router.patch("/me/password", validate(changeMyPasswordSchema), changeMyPassword);
router.patch("/me/avatar", validate(updateMyAvatarSchema), updateMyAvatar);
router.patch("/me/room-prefs", validate(patchChatRoomPrefsSchema), patchChatRoomPrefs);
router.get("/browse", validate(browseUsersSchema), browseUsers);
router.get("/search", validate(searchUsersSchema), searchUsers);

module.exports = router;
