const express = require("express");
const { browseUsers, searchUsers } = require("../controllers/userController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const { browseUsersSchema, searchUsersSchema } = require("../schemas/userSchemas");

const router = express.Router();

router.use(requireAuth);
router.get("/browse", validate(browseUsersSchema), browseUsers);
router.get("/search", validate(searchUsersSchema), searchUsers);

module.exports = router;
