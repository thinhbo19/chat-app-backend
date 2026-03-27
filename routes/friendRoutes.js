const express = require("express");
const {
  sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendList,
  removeFriend,
} = require("../controllers/friendController");
const { requireAuth } = require("../middlewares/authMiddleware");
const { friendRequestLimiter } = require("../middlewares/rateLimit");
const { validate } = require("../middlewares/validate");
const {
  sendRequestSchema,
  requestIdParamsSchema,
  friendUserIdParamsSchema,
} = require("../schemas/friendSchemas");

const router = express.Router();

router.use(requireAuth);
router.post(
  "/request",
  friendRequestLimiter,
  validate(sendRequestSchema),
  sendFriendRequest,
);
router.get("/requests/incoming", getIncomingRequests);
router.get("/requests/outgoing", getOutgoingRequests);
router.post("/request/:requestId/accept", validate(requestIdParamsSchema), acceptFriendRequest);
router.post("/request/:requestId/reject", validate(requestIdParamsSchema), rejectFriendRequest);
router.get("/list", getFriendList);
router.delete("/:friendUserId", validate(friendUserIdParamsSchema), removeFriend);

module.exports = router;
