const { z } = require("zod");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const searchUsersSchema = {
  query: z.object({
    q: z.string().trim().min(1).max(100),
  }),
};

const browseUsersSchema = {
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    after: z.string().regex(objectIdRegex, "Invalid after").optional(),
  }),
};

const updateMyProfileSchema = {
  body: z.object({
    username: z.string().trim().min(3).max(30),
    email: z.string().trim().email(),
    phone: z.string().trim().max(24).optional().default(""),
  }),
};

const changeMyPasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
  }),
};

const updateMyAvatarSchema = {
  body: z.object({
    avatar: z.string().trim().min(1).max(500),
  }),
};

module.exports = {
  searchUsersSchema,
  browseUsersSchema,
  updateMyProfileSchema,
  changeMyPasswordSchema,
  updateMyAvatarSchema,
};
