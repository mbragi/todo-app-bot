// Direct Redis client for LIST operations and advanced commands
const Redis = require('ioredis');
const config = require('./config');
const logger = require('./logger');

let redisClient = null;

/**
 * Create Redis client with Railway configuration
 */
function createRedisClient() {
  if (redisClient) {
    return redisClient;
  }

  try {
    const redisConfig = config.cache.redis;
    
    // Use Redis URL if available (Railway format)
    if (redisConfig.url) {
      redisClient = new Redis(redisConfig.url, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });
    } else {
      // Use individual connection parameters
      redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      });
    }

    redisClient.on('connect', () => {
      logger.info('Redis client connected successfully');
    });

    redisClient.on('error', (error) => {
      logger.error('Redis client error', error);
    });

    redisClient.on('close', () => {
      logger.warn('Redis client connection closed');
    });

    return redisClient;
  } catch (error) {
    logger.error('Failed to create Redis client', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
function getRedisClient() {
  if (!redisClient) {
    return createRedisClient();
  }
  return redisClient;
}

/**
 * Close Redis connection
 */
function closeRedisClient() {
  if (redisClient) {
    redisClient.disconnect();
    redisClient = null;
    logger.info('Redis client disconnected');
  }
}

module.exports = {
  createRedisClient,
  getRedisClient,
  closeRedisClient,
};
