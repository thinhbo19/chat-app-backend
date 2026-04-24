const test = require("node:test");
const assert = require("node:assert/strict");

function buildRes() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    clearedCookies: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, value, options) {
      this.cookies.push({ name, value, options });
      return this;
    },
    clearCookie(name, options) {
      this.clearedCookies.push({ name, options });
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function sendErrorImpl(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
  return res;
}

function setupRefreshControllerMocks({
  verifyPayload = { userId: "u1" },
  userDoc = { _id: "u1", username: "alice", email: "a@a.com" },
  storedTokenDoc = null,
  findUserByQuery = async () => userDoc,
  verifyRefreshTokenImpl,
  deleteOneImpl = async () => ({ deletedCount: 1 }),
  deleteManyImpl = async () => ({ deletedCount: 1 }),
  createImpl = async () => ({ _id: "rt1" }),
} = {}) {
  const authControllerPath = require.resolve("../controllers/authController");
  const userModelPath = require.resolve("../models/User");
  const refreshTokenModelPath = require.resolve("../models/RefreshToken");
  const apiErrorPath = require.resolve("../utils/apiError");
  const tokenUtilsPath = require.resolve("../utils/token");
  const hashUtilsPath = require.resolve("../utils/hash");
  const publicUserPath = require.resolve("../utils/userPublic");
  const authCookiesPath = require.resolve("../utils/authCookies");

  delete require.cache[authControllerPath];
  delete require.cache[userModelPath];
  delete require.cache[refreshTokenModelPath];
  delete require.cache[apiErrorPath];
  delete require.cache[tokenUtilsPath];
  delete require.cache[hashUtilsPath];
  delete require.cache[publicUserPath];
  delete require.cache[authCookiesPath];

  const sendError = sendErrorImpl;
  const verifyRefreshToken =
    verifyRefreshTokenImpl || (() => verifyPayload);
  const signAccessToken = () => "new-access-token";
  const signRefreshToken = () => "new-refresh-token";
  const sha256 = (value) => `hash:${value}`;
  const selfUserPayload = (user) => user;

  const userModel = {
    findOne: findUserByQuery,
    findById: async () => userDoc,
  };
  const refreshTokenModel = {
    findOne: async () => storedTokenDoc,
    deleteOne: deleteOneImpl,
    deleteMany: deleteManyImpl,
    create: createImpl,
  };

  require.cache[userModelPath] = { exports: userModel };
  require.cache[refreshTokenModelPath] = { exports: refreshTokenModel };
  require.cache[apiErrorPath] = { exports: { sendError } };
  require.cache[tokenUtilsPath] = {
    exports: { verifyRefreshToken, signAccessToken, signRefreshToken },
  };
  require.cache[hashUtilsPath] = { exports: { sha256 } };
  require.cache[publicUserPath] = { exports: { selfUserPayload } };
  require.cache[authCookiesPath] = {
    exports: {
      ACCESS_COOKIE: "chat_access_token",
      REFRESH_COOKIE: "chat_refresh_token",
      cookieOptions: () => ({ httpOnly: true, path: "/" }),
    },
  };

  const controller = require("../controllers/authController");
  return { controller };
}

test("refresh rotates refresh token and updates auth cookies", async () => {
  let saved = false;
  const storedTokenDoc = {
    tokenHash: "hash:old-token",
    expiresAt: new Date(),
    async save() {
      saved = true;
    },
  };
  const { controller } = setupRefreshControllerMocks({ storedTokenDoc });
  const req = { body: { refreshToken: "old-refresh-token" } };
  const res = buildRes();

  await controller.refresh(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(storedTokenDoc.tokenHash, "hash:new-refresh-token");
  assert.equal(saved, true);
  assert.equal(res.cookies.length, 2);
});

test("login success sets auth cookies and returns self user payload", async () => {
  const { controller } = setupRefreshControllerMocks({
    findUserByQuery: async () => ({
      _id: "u1",
      username: "alice",
      email: "a@a.com",
      comparePassword: async () => true,
    }),
  });
  const req = { body: { emailOrUsername: "alice", password: "strong-pass" } };
  const res = buildRes();

  await controller.login(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body.user);
  assert.equal(res.cookies.length, 2);
  assert.equal(res.cookies[0].name, "chat_access_token");
  assert.equal(res.cookies[1].name, "chat_refresh_token");
});

test("refresh returns 400 when refresh token is missing", async () => {
  const { controller } = setupRefreshControllerMocks();
  const req = { body: {} };
  const res = buildRes();

  await controller.refresh(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.code, "MISSING_REFRESH");
});

test("refresh accepts refresh token from cookie when body is empty", async () => {
  let saved = false;
  const storedTokenDoc = {
    tokenHash: "hash:cookie-refresh-token",
    expiresAt: new Date(),
    async save() {
      saved = true;
    },
  };
  const { controller } = setupRefreshControllerMocks({ storedTokenDoc });
  const req = { body: {}, cookies: { chat_refresh_token: "cookie-refresh-token" } };
  const res = buildRes();

  await controller.refresh(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(saved, true);
  assert.equal(res.cookies.length, 2);
});

test("login returns 401 for invalid credentials", async () => {
  const { controller } = setupRefreshControllerMocks({
    findUserByQuery: async () => ({
      _id: "u1",
      username: "alice",
      email: "a@a.com",
      comparePassword: async () => false,
    }),
  });
  const req = { body: { emailOrUsername: "alice", password: "wrong-pass" } };
  const res = buildRes();

  await controller.login(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "INVALID_CREDENTIALS");
});

test("refresh returns 401 for invalid refresh token", async () => {
  const { controller } = setupRefreshControllerMocks({
    verifyRefreshTokenImpl: () => {
      throw new Error("bad token");
    },
  });
  const req = { body: { refreshToken: "bad-token" } };
  const res = buildRes();

  await controller.refresh(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error.code, "INVALID_REFRESH");
});

test("logout deletes refresh token hash and returns success", async () => {
  let deletedFilter = null;
  const { controller } = setupRefreshControllerMocks({
    deleteOneImpl: async (filter) => {
      deletedFilter = filter;
      return { deletedCount: 1 };
    },
  });
  const req = { body: { refreshToken: "logout-token" } };
  const res = buildRes();

  await controller.logout(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(deletedFilter, { tokenHash: "hash:logout-token" });
  assert.equal(res.body.message, "Logout success");
  assert.equal(res.clearedCookies.length, 2);
});

test("logout accepts refresh token from cookie", async () => {
  let deletedFilter = null;
  const { controller } = setupRefreshControllerMocks({
    deleteOneImpl: async (filter) => {
      deletedFilter = filter;
      return { deletedCount: 1 };
    },
  });
  const req = { body: {}, cookies: { chat_refresh_token: "cookie-logout-token" } };
  const res = buildRes();

  await controller.logout(req, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(deletedFilter, { tokenHash: "hash:cookie-logout-token" });
});
