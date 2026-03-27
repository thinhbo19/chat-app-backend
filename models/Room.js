const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    /** URL ảnh đại diện nhóm; để trống thì client dùng chữ cái / icon mặc định */
    avatar: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    type: {
      type: String,
      enum: ["group", "direct"],
      default: "group",
    },
    directKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["owner", "admin", "member"],
          default: "member",
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

roomSchema.index({ "members.userId": 1 });

module.exports = mongoose.model("Room", roomSchema);
