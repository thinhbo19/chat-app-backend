const { createClient } = require("redis");
const { logger } = require("./logger");

let client = null;
let ready = false;

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL && String(process.env.REDIS_URL).trim());
}

async function initCacheClient() {
  if (!isRedisEnabled()) {
    logger.info("redis.disabled", {});
    return null;
  }
  if (client) {
    return client;
  }
  const next = createClient({
    url: process.env.REDIS_URL,
  });
  next.on("error", (error) => {
    ready = false;
    logger.warn("redis.error", { message: error.message });
  });
  next.on("ready", () => {
    ready = true;
    logger.info("redis.ready", {});
  });
  next.on("end", () => {
    ready = false;
    logger.warn("redis.end", {});
  });
  try {
    await next.connect();
    client = next;
    return client;
  } catch (error) {
    ready = false;
    logger.warn("redis.connect_failed", { message: error.message });
    return null;
  }
}

function getCacheClient() {
  return client;
}

function isCacheReady() {
  return ready && Boolean(client);
}

module.exports = {
  getCacheClient,
  initCacheClient,
  isCacheReady,
};
