const { z } = require("zod");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const sendRequestSchema = {
  body: z.object({
    toUserId: z.string().regex(objectIdRegex, "Invalid toUserId"),
  }),
};

const requestIdParamsSchema = {
  params: z.object({
    requestId: z.string().regex(objectIdRegex, "Invalid requestId"),
  }),
};

const friendUserIdParamsSchema = {
  params: z.object({
    friendUserId: z.string().regex(objectIdRegex, "Invalid friendUserId"),
  }),
};

module.exports = {
  sendRequestSchema,
  requestIdParamsSchema,
  friendUserIdParamsSchema,
};
