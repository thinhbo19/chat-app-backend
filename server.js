require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

const User = require("./models/User");
const RefreshToken = require("./models/RefreshToken");
const { verifyAccessToken } = require("./utils/token");
const { ACCESS_COOKIE, parseCookieHeader } = require("./utils/authCookies");
const { sendError } = require("./utils/apiError");
const { registerChatSocket } = require("./socket/chatSocket");
const { logger } = require("./utils/logger");

const authRoutes = require("./routes/authRoutes");
const roomRoutes = require("./routes/roomRoutes");
const friendRoutes = require("./routes/friendRoutes");
const userRoutes = require("./routes/userRoutes");
const messageRoutes = require("./routes/messageRoutes");

const app = express();
const server = http.createServer(app);

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

function trustProxySetting() {
  const v = process.env.TRUST_PROXY_HOPS;
  if (v === "0" || v === "false") return false;
  if (v != null && String(v).trim() !== "") return Number(v);
  return process.env.NODE_ENV === "production" ? 1 : false;
}
app.set("trust proxy", trustProxySetting());

function parseCorsOrigins() {
  const raw = process.env.CORS_ORIGIN;
  if (raw == null || String(raw).trim() === "") {
    return true;
  }
  const list = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length > 0 ? list : true;
}

const corsOriginOption = parseCorsOrigins();

app.use(
  cors({
    origin: corsOriginOption,
    credentials: true,
  }),
);
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/health", async (_req, res) => {
  const ready = mongoose.connection.readyState;
  try {
    const db = mongoose.connection.db;
    if (!db) {
      return res.status(503).json({
        status: "degraded",
        mongo: "no_db",
        mongoState: ready,
        uptime: process.uptime(),
      });
    }
    await db.admin().command({ ping: 1 });
    return res.json({
      status: "ok",
      mongo: "connected",
      mongoState: ready,
      uptime: process.uptime(),
    });
  } catch (error) {
    logger.warn("health.mongo_ping_failed", { message: error.message });
    return res.status(503).json({
      status: "error",
      mongo: "unreachable",
      mongoState: ready,
      uptime: process.uptime(),
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.use((error, _req, res, _next) => {
  logger.error("http.unhandled_error", {
    message: error.message,
    stack: error.stack,
  });
  return sendError(res, 500, "INTERNAL_ERROR", "Loi may chu noi bo");
});

const io = new Server(server, {
  cors: {
    origin: corsOriginOption,
    credentials: true,
    methods: ["GET", "POST"],
  },
});
app.set("io", io);

io.use(async (socket, next) => {
  try {
    const fromAuth = socket.handshake.auth?.token;
    const cookieToken = parseCookieHeader(socket.handshake.headers?.cookie || "")[ACCESS_COOKIE];
    const token = fromAuth || cookieToken;
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
    logger.info("mongo.connected", {});
    const db = mongoose.connection.db;
    if (db) {
      try {
        const coll = db.collection("refreshtokens");
        const indexes = await coll.indexes();
        for (const idx of indexes) {
          const key = idx.key || {};
          if (Object.prototype.hasOwnProperty.call(key, "token") && idx.name && idx.name !== "_id_") {
            await coll.dropIndex(idx.name);
            logger.info("mongo.dropped_legacy_refresh_index", { name: idx.name });
          }
        }
      } catch (error) {
        if (error.code !== 26 && error.codeName !== "NamespaceNotFound") {
          logger.warn("mongo.refresh_index_cleanup", { message: error.message });
        }
      }
    }
    try {
      await RefreshToken.syncIndexes();
    } catch (error) {
      logger.warn("mongo.refresh_sync_indexes", { message: error.message });
    }
    server.listen(PORT, "0.0.0.0", () => {
      logger.info("server.listen", { port: PORT, bind: "0.0.0.0" });
    });
  })
  .catch((error) => {
    logger.error("mongo.connect_failed", { message: error.message });
  });
