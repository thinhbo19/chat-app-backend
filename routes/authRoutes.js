const express = require("express");
const {
  register,
  login,
  refresh,
  logout,
  me,
} = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require("../schemas/authSchemas");

const router = express.Router();

router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);
router.post("/refresh", validate(refreshSchema), refresh);
router.post("/logout", validate(refreshSchema), logout);
router.get("/me", requireAuth, me);

module.exports = router;
