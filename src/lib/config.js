const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

// Simple logger for config validation (before main logger is available)
const simpleLogger = {
  warn: (msg) => console.warn(`[CONFIG] ${msg}`),
  error: (msg) => console.error(`[CONFIG] ${msg}`),
};

/**
 * Configuration object with environment validation
 * Fails fast if required environment variables are missing
 */
const config = {
  // Messaging Provider (WaSender only)
  messagingProvider: "wasender",
  timezone: process.env.TZ || "Africa/Lagos",

  // WhatsApp Cloud API (for webhook verification only)
  whatsapp: {
    verifyToken: process.env.VERIFY_TOKEN,
    webhookSecret: process.env.WHATSAPP_WEBHOOK_SECRET,
  },

  // WaSender API
  wasender: {
    apiKey: process.env.WASENDER_API_KEY,
    baseUrl: process.env.WASENDER_BASE_URL || "https://wasenderapi.com/api",
    webhookSecret: process.env.WASENDER_WEBHOOK_SECRET,
  },

  // Google Calendar
  google: {
    credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  },

  // Storage
  store: {
    backend: process.env.STORE_BACKEND || "redis",
  },

  // Cache configuration
  cache: {
    backend: process.env.CACHE_BACKEND || "redis", // memory, redis, memcache
    ttl: parseInt(process.env.CACHE_TTL) || 3600, // 1 hour default

    // Redis configuration (Railway Redis)
    redis: {
      host: process.env.REDISHOST || process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDISPORT || process.env.REDIS_PORT) || 6379,
      password: process.env.REDISPASSWORD || process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB) || 0,
      url: process.env.REDIS_URL, // Full Redis URL for Railway
    },

    // Memcache configuration
    memcache: {
      hosts: process.env.MEMCACHE_HOSTS
        ? process.env.MEMCACHE_HOSTS.split(",")
        : ["localhost:11211"],
    },
  },

  // Cron Schedules
  cron: {
    agenda: process.env.CRON_AGENDA || "0 7 * * *",
    remind: process.env.CRON_REMIND || "*/5 * * * *",
    review: process.env.CRON_REVIEW || "0 18 * * *",
  },

  // OpenAI (optional)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Server
  server: {
    port: parseInt(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
  },
};

/**
 * Validate required configuration based on messaging provider
 */
function validateConfig() {
  const errors = [];

  // Validate WaSender requirements
  if (!config.wasender.apiKey)
    errors.push("WASENDER_API_KEY is required for wasender provider");

  // Validate Google OAuth requirements (only if using OAuth)
  if (
    config.store.backend === "memory" &&
    (!config.google.clientId ||
      !config.google.clientSecret ||
      !config.google.redirectUri)
  ) {
    simpleLogger.warn(
      "Google OAuth credentials not configured - OAuth features will be disabled"
    );
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
}

// Validate configuration on module load
validateConfig();

module.exports = config;
