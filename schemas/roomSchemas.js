const { z } = require("zod");

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

const createRoomSchema = {
  body: z.object({
    name: z.string().trim().min(2).max(80),
    memberIds: z.array(z.string().regex(objectIdRegex)).optional().default([]),
    avatar: z.string().trim().max(500).optional().default(""),
  }),
};

const updateGroupRoomSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      avatar: z.string().trim().max(500).optional(),
    })
    .refine((data) => data.name !== undefined || data.avatar !== undefined, {
      message: "Can cap nhat it nhat name hoac avatar",
    }),
};

const leaveGroupSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
  body: z
    .object({
      newOwnerUserId: z.string().regex(objectIdRegex, "Invalid newOwnerUserId").optional(),
    })
    .default({}),
};

const removeMemberParamsSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
    memberUserId: z.string().regex(objectIdRegex, "Invalid memberUserId"),
  }),
};

const roomIdParamsSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
};

const groupInviteIdParamsSchema = {
  params: z.object({
    inviteId: z.string().regex(objectIdRegex, "Invalid inviteId"),
  }),
};

const updateMemberRoleSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
    memberUserId: z.string().regex(objectIdRegex, "Invalid memberUserId"),
  }),
  body: z.object({
    role: z.enum(["admin", "member"]),
  }),
};

const addMemberToGroupSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
  body: z.object({
    memberUserId: z.string().regex(objectIdRegex, "Invalid memberUserId"),
  }),
};

const directRoomParamsSchema = {
  params: z.object({
    friendUserId: z.string().regex(objectIdRegex, "Invalid friendUserId"),
  }),
};

const getRoomMessagesQuerySchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
  query: z.object({
    before: z.string().regex(objectIdRegex).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  }),
};

const roomMessageIdParamsSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
    messageId: z.string().regex(objectIdRegex, "Invalid messageId"),
  }),
};

const markRoomReadSchema = {
  params: z.object({
    roomId: z.string().regex(objectIdRegex, "Invalid roomId"),
  }),
  body: z.object({
    messageId: z.string().regex(objectIdRegex, "Invalid messageId"),
  }),
};

module.exports = {
  createRoomSchema,
  updateGroupRoomSchema,
  leaveGroupSchema,
  removeMemberParamsSchema,
  roomIdParamsSchema,
  groupInviteIdParamsSchema,
  updateMemberRoleSchema,
  addMemberToGroupSchema,
  directRoomParamsSchema,
  getRoomMessagesQuerySchema,
  roomMessageIdParamsSchema,
  markRoomReadSchema,
};
