const mongoose = require("mongoose");

const groupInviteSchema = new mongoose.Schema(
  {
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    inviteeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    invitedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

groupInviteSchema.index({ roomId: 1, inviteeUserId: 1, status: 1 });

module.exports = mongoose.model("GroupInvite", groupInviteSchema);
