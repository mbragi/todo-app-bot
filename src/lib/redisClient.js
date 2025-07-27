const redis = require("redis");
const config = require("./config");
const logger = require("./logger");

let client = null;

/**
 * Get Redis client singleton
 * Creates connection if not exists
 * @returns {Promise<redis.RedisClient>}
 */
async function getRedisClient() {
  if (client && client.isReady) {
    return client;
  }

  try {
    client = redis.createClient({
      url: config.redis.url,
    });

    client.on("error", (err) => {
      logger.error("Redis client error", err, { provider: "redis" });
    });

    client.on("connect", () => {
      logger.info("Redis client connected", { provider: "redis" });
    });

    client.on("ready", () => {
      logger.info("Redis client ready", { provider: "redis" });
    });

    client.on("end", () => {
      logger.info("Redis client disconnected", { provider: "redis" });
    });

    await client.connect();
    return client;
  } catch (error) {
    logger.error("Failed to create Redis client", error, { provider: "redis" });
    throw error;
  }
}

/**
 * Close Redis connection
 */
async function closeRedisClient() {
  if (client) {
    await client.quit();
    client = null;
    logger.info("Redis client closed", { provider: "redis" });
  }
}

module.exports = {
  getRedisClient,
  closeRedisClient,
};
