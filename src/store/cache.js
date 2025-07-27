// Cache-based store using cache-manager (supports Redis, Memcache, Memory)
const cache = require("../lib/cache");
const logger = require("../lib/logger");

// Helper to serialize/deserialize data for cache storage
function serialize(value) {
  return JSON.stringify(value);
}

function deserialize(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error("Failed to deserialize cached value", error, { value });
    return null;
  }
}

module.exports = {
  // SET ops (for users:set, allowlist, etc.)
  async sadd(key, member) {
    try {
      const setKey = `set:${key}`;
      const existing = await cache.get(setKey);
      const set = existing ? deserialize(existing) : [];

      if (!set.includes(member)) {
        set.push(member);
        await cache.set(setKey, serialize(set));
      }
    } catch (error) {
      logger.error("Cache sadd error", error, { key, member });
    }
  },

  async smembers(key) {
    try {
      const setKey = `set:${key}`;
      const existing = await cache.get(setKey);
      return existing ? deserialize(existing) : [];
    } catch (error) {
      logger.error("Cache smembers error", error, { key });
      return [];
    }
  },

  async sismember(key, member) {
    try {
      const setKey = `set:${key}`;
      const existing = await cache.get(setKey);
      const set = existing ? deserialize(existing) : [];
      return set.includes(member);
    } catch (error) {
      logger.error("Cache sismember error", error, { key, member });
      return false;
    }
  },

  // HASH ops (for per-user settings and tokens)
  async hget(key, field) {
    try {
      const hashKey = `hash:${key}`;
      const existing = await cache.get(hashKey);
      const hash = existing ? deserialize(existing) : {};
      return hash[field] ?? null;
    } catch (error) {
      logger.error("Cache hget error", error, { key, field });
      return null;
    }
  },

  async hset(key, field, value) {
    try {
      const hashKey = `hash:${key}`;
      const existing = await cache.get(hashKey);
      const hash = existing ? deserialize(existing) : {};
      hash[field] = value;
      await cache.set(hashKey, serialize(hash));
    } catch (error) {
      logger.error("Cache hset error", error, {
        key,
        field,
        hasValue: !!value,
      });
    }
  },

  async hgetall(key) {
    try {
      const hashKey = `hash:${key}`;
      const existing = await cache.get(hashKey);
      return existing ? deserialize(existing) : {};
    } catch (error) {
      logger.error("Cache hgetall error", error, { key });
      return {};
    }
  },

  // STRING ops (flags/caches)
  async get(key) {
    try {
      return await cache.get(key);
    } catch (error) {
      logger.error("Cache get error", error, { key });
      return null;
    }
  },

  async set(key, value) {
    try {
      await cache.set(key, value);
    } catch (error) {
      logger.error("Cache set error", error, { key, hasValue: !!value });
    }
  },
};
