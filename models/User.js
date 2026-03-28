const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      default: "",
      trim: true,
      maxlength: 24,
    },
    status: {
      type: String,
      enum: ["offline", "online"],
      default: "offline",
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    /** Tùy chọn theo phòng: tắt thông báo, ghim phòng lên đầu sidebar. */
    chatRoomPrefs: [
      {
        roomId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Room",
          required: true,
        },
        muted: { type: Boolean, default: false },
        sidebarPinned: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: true },
);

userSchema.methods.comparePassword = function comparePassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);
