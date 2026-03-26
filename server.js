require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const User = require("./models/User");
const RefreshToken = require("./models/RefreshToken");
const { verifyAccessToken } = require("./utils/token");
const { sendError } = require("./utils/apiError");
const { registerChatSocket } = require("./socket/chatSocket");

const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const friendRoutes = require("./routes/friendRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
const server = http.createServer(app);

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mongoState: mongoose.connection.readyState,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  return sendError(res, 500, "INTERNAL_ERROR", "Loi may chu noi bo");
});

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId).select("username email");
    if (!user) {
      return next(new Error("User not found"));
    }
    socket.data.userId = user._id.toString();
    socket.data.username = user.username;
    return next();
  } catch (_error) {
    return next(new Error("Invalid token"));
  }
});

registerChatSocket(io);

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("MongoDB connected");
    const db = mongoose.connection.db;
    if (db) {
      try {
        const coll = db.collection("refreshtokens");
        const indexes = await coll.indexes();
        for (const idx of indexes) {
          const key = idx.key || {};
          if (Object.prototype.hasOwnProperty.call(key, "token") && idx.name && idx.name !== "_id_") {
            await coll.dropIndex(idx.name);
            console.log(`[mongo] Dropped legacy refreshtokens index "${idx.name}" (token field removed from schema)`);
          }
        }
      } catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") {
          console.warn("[mongo] refreshtokens legacy index cleanup:", error.message);
        }
      }
    }
    try {
      await RefreshToken.syncIndexes();
    } catch (error) {
      console.warn("RefreshToken.syncIndexes:", error.message);
    }
    server.listen(PORT, () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });
