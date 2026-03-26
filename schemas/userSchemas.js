const { z } = require("zod");

const searchUsersSchema = {
  query: z.object({
    q: z.string().trim().min(1).max(100),
  }),
};

module.exports = { searchUsersSchema };
