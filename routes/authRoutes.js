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
  authStrictLimiter,
  authRefreshLimiter,
} = require("../middlewares/rateLimit");
const {
  registerSchema,
  loginSchema,
  refreshSchema,
} = require("../schemas/authSchemas");

const router = express.Router();

router.post("/register", authStrictLimiter, validate(registerSchema), register);
router.post("/login", authStrictLimiter, validate(loginSchema), login);
router.post("/refresh", authRefreshLimiter, validate(refreshSchema), refresh);
router.post("/logout", authRefreshLimiter, validate(refreshSchema), logout);
router.get("/me", requireAuth, me);

module.exports = router;
