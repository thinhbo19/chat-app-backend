const { getCacheClient, isCacheReady } = require("./cacheClient");
const { logger } = require("./logger");

const ROOM_LIST_TTL_SEC = 20;
const UNREAD_SUMMARY_TTL_SEC = 10;
const CACHE_KEY_PREFIX = String(process.env.CACHE_KEY_PREFIX || "chat:v1").trim() || "chat:v1";
const cacheStats = {
  hit: 0,
  miss: 0,
  set: 0,
  invalidate: 0,
  errors: 0,
};

function roomsKey(userId) {
  return `${CACHE_KEY_PREFIX}:rooms:${String(userId)}`;
}

function unreadSummaryKey(userId) {
  return `${CACHE_KEY_PREFIX}:unread:${String(userId)}`;
}

async function getJsonCache(key) {
  if (!isCacheReady()) {
    cacheStats.miss += 1;
    return null;
  }
  const client = getCacheClient();
  if (!client) {
    cacheStats.miss += 1;
    return null;
  }
  try {
    const raw = await client.get(key);
    if (!raw) {
      cacheStats.miss += 1;
      logger.info("redis.cache_miss", { key });
      return null;
    }
    cacheStats.hit += 1;
    logger.info("redis.cache_hit", { key });
    return JSON.parse(raw);
  } catch (error) {
    cacheStats.errors += 1;
    logger.warn("redis.get_json_failed", { key, message: error.message });
    return null;
  }
}

async function setJsonCache(key, value, ttlSec) {
  if (!isCacheReady()) return;
  const client = getCacheClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSec });
    cacheStats.set += 1;
    logger.info("redis.cache_set", { key, ttlSec });
  } catch (error) {
    cacheStats.errors += 1;
    logger.warn("redis.set_json_failed", { key, message: error.message });
  }
}

async function invalidateUserChatCache(userId) {
  const uid = String(userId || "").trim();
  if (!uid) return;
  if (!isCacheReady()) return;
  const client = getCacheClient();
  if (!client) return;
  try {
    const deleted = await client.del([roomsKey(uid), unreadSummaryKey(uid)]);
    cacheStats.invalidate += deleted;
    logger.info("redis.cache_invalidate_user", { userId: uid, deleted });
  } catch (error) {
    cacheStats.errors += 1;
    logger.warn("redis.invalidate_user_chat_failed", { userId: uid, message: error.message });
  }
}

async function invalidateUsersChatCache(userIds) {
  const ids = Array.isArray(userIds) ? userIds : [];
  if (ids.length === 0) return;
  const uniq = [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
  if (uniq.length === 0) return;
  await Promise.all(uniq.map((id) => invalidateUserChatCache(id)));
}

function getCacheStats() {
  const lookups = cacheStats.hit + cacheStats.miss;
  const hitRate = lookups > 0 ? Number((cacheStats.hit / lookups).toFixed(4)) : 0;
  return {
    ...cacheStats,
    prefix: CACHE_KEY_PREFIX,
    lookups,
    hitRate,
  };
}

module.exports = {
  CACHE_KEY_PREFIX,
  ROOM_LIST_TTL_SEC,
  UNREAD_SUMMARY_TTL_SEC,
  getCacheStats,
  getJsonCache,
  invalidateUserChatCache,
  invalidateUsersChatCache,
  roomsKey,
  setJsonCache,
  unreadSummaryKey,
};
