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

module.exports = { searchUsersSchema, browseUsersSchema };
