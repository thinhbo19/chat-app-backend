const { z } = require("zod");

const registerSchema = {
  body: z.object({
    username: z.string().trim().min(3).max(30),
    email: z.string().trim().email(),
    password: z.string().min(6).max(128),
  }),
};

const loginSchema = {
  body: z.object({
    emailOrUsername: z.string().trim().min(3).max(100),
    password: z.string().min(6).max(128),
  }),
};

const refreshSchema = {
  body: z.object({
    refreshToken: z.string().trim().min(16).optional(),
  }),
};

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
};
