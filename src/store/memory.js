// Memory store extension for LIST operations (goals and history)
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
  // LIST ops for goals and history
  async lpush(key, value) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      list.unshift(value); // Add to front of list
      await cache.set(listKey, serialize(list));
      return list.length;
    } catch (error) {
      logger.error("Memory lpush error", error, { key, hasValue: !!value });
      return 0;
    }
  },

  async rpush(key, value) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      list.push(value); // Add to end of list
      await cache.set(listKey, serialize(list));
      return list.length;
    } catch (error) {
      logger.error("Memory rpush error", error, { key, hasValue: !!value });
      return 0;
    }
  },

  async lrange(key, start = 0, end = -1) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      if (end === -1) {
        return list.slice(start);
      }
      return list.slice(start, end + 1);
    } catch (error) {
      logger.error("Memory lrange error", error, { key, start, end });
      return [];
    }
  },

  async llen(key) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      return list.length;
    } catch (error) {
      logger.error("Memory llen error", error, { key });
      return 0;
    }
  },

  async lrem(key, index) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      if (index >= 0 && index < list.length) {
        const removed = list.splice(index, 1);
        await cache.set(listKey, serialize(list));
        return removed[0];
      }
      return null;
    } catch (error) {
      logger.error("Memory lrem error", error, { key, index });
      return null;
    }
  },

  async lset(key, index, value) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      if (index >= 0 && index < list.length) {
        list[index] = value;
        await cache.set(listKey, serialize(list));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("Memory lset error", error, { key, index, hasValue: !!value });
      return false;
    }
  },

  // Capped list operations for history (max 50 items)
  async lpushCapped(key, value, maxSize = 50) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      list.unshift(value); // Add to front
      
      // Cap the list size
      if (list.length > maxSize) {
        list.splice(maxSize); // Remove items beyond maxSize
      }
      
      await cache.set(listKey, serialize(list));
      return list.length;
    } catch (error) {
      logger.error("Memory lpushCapped error", error, { key, hasValue: !!value, maxSize });
      return 0;
    }
  },

  async rpushCapped(key, value, maxSize = 50) {
    try {
      const listKey = `list:${key}`;
      const existing = await cache.get(listKey);
      const list = existing ? deserialize(existing) : [];
      
      list.push(value); // Add to end
      
      // Cap the list size
      if (list.length > maxSize) {
        list.shift(); // Remove from front to maintain maxSize
      }
      
      await cache.set(listKey, serialize(list));
      return list.length;
    } catch (error) {
      logger.error("Memory rpushCapped error", error, { key, hasValue: !!value, maxSize });
      return 0;
    }
  }
};