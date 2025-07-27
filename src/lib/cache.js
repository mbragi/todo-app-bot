const cacheManager = require("cache-manager");
const redisStore = require("cache-manager-redis-store");
const memcachedStore = require("cache-manager-memcached-store");
const config = require("./config");
const logger = require("./logger");

let cache;

/**
 * Initialize cache based on configuration
 */
function initializeCache() {
  const cacheConfig = config.cache || {};

  if (cacheConfig.backend === "redis" && cacheConfig.redis) {
    // Redis configuration
    cache = cacheManager.caching({
      store: redisStore,
      host: cacheConfig.redis.host || "localhost",
      port: cacheConfig.redis.port || 6379,
      password: cacheConfig.redis.password,
      db: cacheConfig.redis.db || 0,
      ttl: cacheConfig.ttl || 3600, // 1 hour default
    });
    logger.info("Cache initialized with Redis", {
      host: cacheConfig.redis.host,
      port: cacheConfig.redis.port,
    });
  } else if (cacheConfig.backend === "memcache" && cacheConfig.memcache) {
    // Memcache configuration
    cache = cacheManager.caching({
      store: memcachedStore,
      hosts: cacheConfig.memcache.hosts || ["localhost:11211"],
      ttl: cacheConfig.ttl || 3600, // 1 hour default
    });
    logger.info("Cache initialized with Memcache", {
      hosts: cacheConfig.memcache.hosts,
    });
  } else {
    // Fallback to memory cache
    cache = cacheManager.caching({
      store: "memory",
      max: 100,
      ttl: cacheConfig.ttl || 3600, // 1 hour default
    });
    logger.info("Cache initialized with memory store");
  }
}

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} - Cached value or null
 */
async function get(key) {
  try {
    // For cache-manager v5, we need to use the cache instance directly
    return await cache.get(key);
  } catch (error) {
    logger.error("Cache get error", error, { key });
    return null;
  }
}

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (optional)
 * @returns {Promise<void>}
 */
async function set(key, value, ttl = null) {
  try {
    if (ttl) {
      await cache.set(key, value, { ttl });
    } else {
      await cache.set(key, value);
    }
  } catch (error) {
    logger.error("Cache set error", error, { key, hasValue: !!value });
  }
}

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<void>}
 */
async function del(key) {
  try {
    await cache.del(key);
  } catch (error) {
    logger.error("Cache delete error", error, { key });
  }
}

/**
 * Clear all cache
 * @returns {Promise<void>}
 */
async function reset() {
  try {
    await cache.reset();
  } catch (error) {
    logger.error("Cache reset error", error);
  }
}

// Initialize cache on module load
initializeCache();

module.exports = {
  get,
  set,
  del,
  reset,
  initializeCache,
};
