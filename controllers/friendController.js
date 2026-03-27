const mongoose = require("mongoose");
const FriendRequest = require("../models/FriendRequest");
const User = require("../models/User");
const Room = require("../models/Room");
const Message = require("../models/Message");
const { ensureDirectRoomForUsers, buildDirectKey } = require("../utils/room");
const { sendError } = require("../utils/apiError");

function meId(req) {
  return req.user && req.user._id ? req.user._id : null;
}

async function sendFriendRequest(req, res) {
  const { toUserId } = req.body;
  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  if (!mongoose.Types.ObjectId.isValid(toUserId)) {
    return sendError(res, 400, "INVALID_USER_ID", "ID nguoi dung khong hop le");
  }
  if (String(toUserId) === myId.toString()) {
    return sendError(res, 400, "INVALID_TARGET", "Khong the gui loi moi cho chinh minh");
  }

  const targetUser = await User.findById(toUserId);
  if (!targetUser) {
    return sendError(res, 404, "USER_NOT_FOUND", "Khong tim thay nguoi dung");
  }

  const reversePending = await FriendRequest.findOne({
    fromUserId: toUserId,
    toUserId: myId,
    status: "pending",
  });
  if (reversePending) {
    reversePending.status = "accepted";
    await reversePending.save();
    const directRoom = await ensureDirectRoomForUsers(myId, toUserId);
    const io = req.app.get("io");
    io.to(`user:${myId}`).emit("friendship_updated", {
      friendUserId: toUserId,
    });
    io.to(`user:${toUserId}`).emit("friendship_updated", {
      friendUserId: myId.toString(),
    });
    io.to(`user:${myId}`).emit("room_list_changed", {
      roomId: directRoom._id.toString(),
    });
    io.to(`user:${toUserId}`).emit("room_list_changed", {
      roomId: directRoom._id.toString(),
    });
    return res.json({
      message: "Friend request auto accepted",
      request: reversePending,
    });
  }

  const existing = await FriendRequest.findOne({
    fromUserId: myId,
    toUserId,
  });
  if (existing) {
    if (existing.status === "accepted") {
      return sendError(res, 409, "ALREADY_FRIENDS", "Hai nguoi da la ban be");
    }
    if (existing.status === "pending") {
      return sendError(res, 409, "REQUEST_PENDING", "Loi moi dang cho xu ly");
    }
    existing.status = "pending";
    await existing.save();
    const requestWithUser = await FriendRequest.findById(existing._id).populate(
      "fromUserId",
      "username email avatar status lastSeenAt",
    );
    const io = req.app.get("io");
    io.to(`user:${toUserId}`).emit("friend_request_received", {
      request: requestWithUser,
    });
    io.to(`user:${myId}`).emit("friend_data_changed");
    io.to(`user:${toUserId}`).emit("friend_data_changed");
    return res.json({ message: "Friend request sent again", request: requestWithUser });
  }

  const request = await FriendRequest.create({
    fromUserId: myId,
    toUserId,
    status: "pending",
  });

  const requestWithUser = await FriendRequest.findById(request._id).populate(
    "fromUserId",
    "username email avatar status lastSeenAt",
  );
  const io = req.app.get("io");
  io.to(`user:${toUserId}`).emit("friend_request_received", {
    request: requestWithUser,
  });
  io.to(`user:${myId}`).emit("friend_data_changed");
  io.to(`user:${toUserId}`).emit("friend_data_changed");

  return res.status(201).json({ message: "Friend request sent", request: requestWithUser });
}

async function getIncomingRequests(req, res) {
  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  const requests = await FriendRequest.find({
    toUserId: myId,
    status: "pending",
  })
    .populate("fromUserId", "username email avatar status lastSeenAt")
    .sort({ createdAt: -1 });

  const mine = requests.filter((r) => r.toUserId.toString() === myId.toString());
  return res.json({ requests: mine });
}

async function getOutgoingRequests(req, res) {
  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  const requests = await FriendRequest.find({
    fromUserId: myId,
    status: "pending",
  })
    .populate("toUserId", "username email avatar status lastSeenAt")
    .sort({ createdAt: -1 });

  const mine = requests.filter((r) => r.fromUserId.toString() === myId.toString());
  return res.json({ requests: mine });
}

async function acceptFriendRequest(req, res) {
  const { requestId } = req.params;

  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  const request = await FriendRequest.findOne({
    _id: requestId,
    toUserId: myId,
    status: "pending",
  });
  if (!request) {
    return sendError(res, 404, "REQUEST_NOT_FOUND", "Khong tim thay loi moi");
  }

  request.status = "accepted";
  await request.save();
  const directRoom = await ensureDirectRoomForUsers(
    request.fromUserId.toString(),
    request.toUserId.toString(),
  );
  const io = req.app.get("io");
  io.to(`user:${request.fromUserId.toString()}`).emit("friendship_updated", {
    friendUserId: myId.toString(),
  });
  io.to(`user:${request.toUserId.toString()}`).emit("friendship_updated", {
    friendUserId: request.fromUserId.toString(),
  });
  io.to(`user:${request.fromUserId.toString()}`).emit("friend_data_changed");
  io.to(`user:${request.toUserId.toString()}`).emit("friend_data_changed");
  io.to(`user:${request.fromUserId.toString()}`).emit("room_list_changed", {
    roomId: directRoom._id.toString(),
  });
  io.to(`user:${request.toUserId.toString()}`).emit("room_list_changed", {
    roomId: directRoom._id.toString(),
  });

  return res.json({ message: "Friend request accepted", request });
}

async function rejectFriendRequest(req, res) {
  const { requestId } = req.params;

  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  const request = await FriendRequest.findOne({
    _id: requestId,
    toUserId: myId,
    status: "pending",
  });
  if (!request) {
    return sendError(res, 404, "REQUEST_NOT_FOUND", "Khong tim thay loi moi");
  }

  request.status = "rejected";
  await request.save();
  const io = req.app.get("io");
  io.to(`user:${request.fromUserId.toString()}`).emit("friend_request_updated", {
    requestId: request._id.toString(),
    status: "rejected",
  });
  io.to(`user:${request.fromUserId.toString()}`).emit("friend_data_changed");
  io.to(`user:${request.toUserId.toString()}`).emit("friend_data_changed");

  return res.json({ message: "Friend request rejected", request });
}

async function getFriendList(req, res) {
  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  const requests = await FriendRequest.find({
    status: "accepted",
    $or: [{ fromUserId: myId }, { toUserId: myId }],
  })
    .populate("fromUserId", "username email avatar status lastSeenAt")
    .populate("toUserId", "username email avatar status lastSeenAt")
    .sort({ updatedAt: -1 });

  const friends = requests
    .map((request) => {
      const from = request.fromUserId;
      const to = request.toUserId;
      if (!from || !to || !from._id || !to._id) {
        return null;
      }
      const isRequester = from._id.toString() === myId.toString();
      return isRequester ? to : from;
    })
    .filter(Boolean);

  return res.json({ friends });
}

async function removeFriend(req, res) {
  const { friendUserId } = req.params;
  const myId = meId(req);
  if (!myId) {
    return sendError(res, 401, "UNAUTHORIZED", "Khong xac dinh duoc nguoi dung");
  }
  if (friendUserId === myId.toString()) {
    return sendError(res, 400, "INVALID_TARGET", "Khong the xoa chinh minh");
  }

  const relation = await FriendRequest.findOne({
    status: "accepted",
    $or: [
      { fromUserId: myId, toUserId: friendUserId },
      { fromUserId: friendUserId, toUserId: myId },
    ],
  });

  if (!relation) {
    return sendError(res, 404, "NOT_FRIENDS", "Khong tim thay moi quan he ban be");
  }

  await FriendRequest.deleteOne({ _id: relation._id });

  const directKey = buildDirectKey(myId, friendUserId);
  const directRoom = await Room.findOneAndDelete({
    type: "direct",
    directKey,
  });
  if (directRoom) {
    await Message.deleteMany({ roomId: directRoom._id });
  }

  const io = req.app.get("io");
  io.to(`user:${myId}`).emit("friendship_removed", {
    friendUserId,
  });
  io.to(`user:${friendUserId}`).emit("friendship_removed", {
    friendUserId: myId.toString(),
  });
  io.to(`user:${myId}`).emit("friend_data_changed");
  io.to(`user:${friendUserId}`).emit("friend_data_changed");
  io.to(`user:${myId}`).emit("room_list_changed");
  io.to(`user:${friendUserId}`).emit("room_list_changed");
  if (directRoom) {
    io.to(`user:${myId}`).emit("direct_room_removed", {
      roomId: directRoom._id.toString(),
    });
    io.to(`user:${friendUserId}`).emit("direct_room_removed", {
      roomId: directRoom._id.toString(),
    });
  }

  return res.json({ message: "Friend removed successfully" });
}

module.exports = {
  sendFriendRequest,
  getIncomingRequests,
  getOutgoingRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendList,
  removeFriend,
};
