const express = require("express");
const {
  createRoom,
  getMyRooms,
  joinRoom,
  updateGroupRoom,
  updateMemberRole,
  addMemberToGroup,
  listPendingGroupInvites,
  acceptGroupInvite,
  declineGroupInvite,
  leaveGroup,
  removeMemberFromGroup,
  getOrCreateDirectRoom,
  getRoomMessages,
  deleteRoomMessage,
  markRoomRead,
  getRoomReadStates,
  getUnreadSummary,
} = require("../controllers/roomController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { validate } = require("../middlewares/validate");
const {
  createRoomSchema,
  updateGroupRoomSchema,
  directRoomParamsSchema,
  roomIdParamsSchema,
  groupInviteIdParamsSchema,
  addMemberToGroupSchema,
  leaveGroupSchema,
  removeMemberParamsSchema,
  updateMemberRoleSchema,
  getRoomMessagesQuerySchema,
  roomMessageIdParamsSchema,
  markRoomReadSchema,
} = require("../schemas/roomSchemas");

const router = express.Router();

router.use(requireAuth);
router.post("/", validate(createRoomSchema), createRoom);
router.patch("/:roomId", validate(updateGroupRoomSchema), updateGroupRoom);
router.get("/my", getMyRooms);
router.get("/unread-summary", getUnreadSummary);
router.get("/group-invites/pending", listPendingGroupInvites);
router.post(
  "/group-invites/:inviteId/accept",
  validate(groupInviteIdParamsSchema),
  acceptGroupInvite,
);
router.post(
  "/group-invites/:inviteId/decline",
  validate(groupInviteIdParamsSchema),
  declineGroupInvite,
);
router.post("/direct/:friendUserId", validate(directRoomParamsSchema), getOrCreateDirectRoom);
router.get("/:roomId/read-state", validate(roomIdParamsSchema), getRoomReadStates);
router.get("/:roomId/messages", validate(getRoomMessagesQuerySchema), getRoomMessages);
router.delete(
  "/:roomId/messages/:messageId",
  validate(roomMessageIdParamsSchema),
  deleteRoomMessage,
);
router.post("/:roomId/read", validate(markRoomReadSchema), markRoomRead);
router.post("/:roomId/join", validate(roomIdParamsSchema), joinRoom);
router.post("/:roomId/leave", validate(leaveGroupSchema), leaveGroup);
router.delete(
  "/:roomId/members/:memberUserId",
  validate(removeMemberParamsSchema),
  removeMemberFromGroup,
);
router.post("/:roomId/members", validate(addMemberToGroupSchema), addMemberToGroup);
router.patch(
  "/:roomId/members/:memberUserId/role",
  validate(updateMemberRoleSchema),
  updateMemberRole,
);

module.exports = router;
