const express = require("express");
const {
  createRoom,
  getMyRooms,
  joinRoom,
  updateMemberRole,
  addMemberToGroup,
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
  directRoomParamsSchema,
  roomIdParamsSchema,
  addMemberToGroupSchema,
  updateMemberRoleSchema,
  getRoomMessagesQuerySchema,
  roomMessageIdParamsSchema,
  markRoomReadSchema,
} = require("../schemas/roomSchemas");

const router = express.Router();

router.use(requireAuth);
router.post("/", validate(createRoomSchema), createRoom);
router.get("/my", getMyRooms);
router.get("/unread-summary", getUnreadSummary);
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
router.post("/:roomId/members", validate(addMemberToGroupSchema), addMemberToGroup);
router.patch(
  "/:roomId/members/:memberUserId/role",
  validate(updateMemberRoleSchema),
  updateMemberRole,
);

module.exports = router;
