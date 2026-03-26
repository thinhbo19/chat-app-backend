const express = require("express");
const { searchUsers } = require("../controllers/userController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const { searchUsersSchema } = require("../schemas/userSchemas");

const router = express.Router();

router.use(requireAuth);
router.get("/search", validate(searchUsersSchema), searchUsers);

module.exports = router;
