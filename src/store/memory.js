// Memory store extension for LIST operations (goals and history) using Redis
const { getRedisClient } = require("../lib/redisClient");
const logger = require("../lib/logger");

// Helper to serialize/deserialize data for Redis storage
function serialize(value) {
  return JSON.stringify(value);
}

function deserialize(value) {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error("Failed to deserialize Redis value", error, { value });
    return null;
  }
}

module.exports = {
  // LIST ops for goals and history using Redis
  async lpush(key, value) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      const serializedValue = serialize(value);
      
      const length = await redis.lpush(listKey, serializedValue);
      return length;
    } catch (error) {
      logger.error("Redis lpush error", error, { key, hasValue: !!value });
      return 0;
    }
  },

  async rpush(key, value) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      const serializedValue = serialize(value);
      
      const length = await redis.rpush(listKey, serializedValue);
      return length;
    } catch (error) {
      logger.error("Redis rpush error", error, { key, hasValue: !!value });
      return 0;
    }
  },

  async lrange(key, start = 0, end = -1) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      
      const items = await redis.lrange(listKey, start, end);
      return items.map(item => deserialize(item)).filter(item => item !== null);
    } catch (error) {
      logger.error("Redis lrange error", error, { key, start, end });
      return [];
    }
  },

  async llen(key) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      
      const length = await redis.llen(listKey);
      return length;
    } catch (error) {
      logger.error("Redis llen error", error, { key });
      return 0;
    }
  },

  async lrem(key, index) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      
      // Get the item at the index first
      const item = await redis.lindex(listKey, index);
      if (!item) return null;
      
      // For removing by index, we need to use a different approach
      // Get all items, remove the one at index, and replace the list
      const allItems = await redis.lrange(listKey, 0, -1);
      if (index >= 0 && index < allItems.length) {
        const removed = allItems.splice(index, 1)[0];
        
        // Replace the entire list
        await redis.del(listKey);
        if (allItems.length > 0) {
          await redis.rpush(listKey, ...allItems);
        }
        
        return deserialize(removed);
      }
      return null;
    } catch (error) {
      logger.error("Redis lrem error", error, { key, index });
      return null;
    }
  },

  async lset(key, index, value) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      const serializedValue = serialize(value);
      
      const result = await redis.lset(listKey, index, serializedValue);
      return result === 'OK';
    } catch (error) {
      logger.error("Redis lset error", error, { key, index, hasValue: !!value });
      return false;
    }
  },

  // Capped list operations for history (max 50 items)
  async lpushCapped(key, value, maxSize = 50) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      const serializedValue = serialize(value);
      
      // Use Redis transaction to ensure atomicity
      const multi = redis.multi();
      multi.lpush(listKey, serializedValue);
      multi.ltrim(listKey, 0, maxSize - 1); // Keep only first maxSize items
      
      const results = await multi.exec();
      return results[0][1]; // Return length from lpush
    } catch (error) {
      logger.error("Redis lpushCapped error", error, { key, hasValue: !!value, maxSize });
      return 0;
    }
  },

  async rpushCapped(key, value, maxSize = 50) {
    try {
      const redis = getRedisClient();
      const listKey = `list:${key}`;
      const serializedValue = serialize(value);
      
      // Use Redis transaction to ensure atomicity
      const multi = redis.multi();
      multi.rpush(listKey, serializedValue);
      multi.ltrim(listKey, -maxSize, -1); // Keep only last maxSize items
      
      const results = await multi.exec();
      return results[0][1]; // Return length from rpush
    } catch (error) {
      logger.error("Redis rpushCapped error", error, { key, hasValue: !!value, maxSize });
      return 0;
    }
  }
};