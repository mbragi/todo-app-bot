const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

/**
 * Configuration object with environment validation
 * Fails fast if required environment variables are missing
 */
const config = {
  // Messaging Provider
  messagingProvider: process.env.MESSAGING_PROVIDER || "wasender",
  timezone: process.env.TZ || "Africa/Lagos",

  // WhatsApp Cloud API
  whatsapp: {
    token: process.env.WHATSAPP_TOKEN,
    phoneNumberId: process.env.PHONE_NUMBER_ID,
    verifyToken: process.env.VERIFY_TOKEN,
  },

  // WaSender API
  wasender: {
    apiKey: process.env.WASENDER_API_KEY,
    baseUrl: process.env.WASENDER_BASE_URL || "https://wasenderapi.com/api",
  },

  // Google Calendar
  google: {
    credentialsJson: process.env.GOOGLE_CREDENTIALS_JSON,
    calendarId: process.env.GOOGLE_CALENDAR_ID,
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379/0",
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

  // Validate messaging provider
  if (!["wasender", "cloud"].includes(config.messagingProvider)) {
    errors.push('MESSAGING_PROVIDER must be either "wasender" or "cloud"');
  }

  // Validate provider-specific requirements
  if (config.messagingProvider === "cloud") {
    if (!config.whatsapp.token)
      errors.push("WHATSAPP_TOKEN is required for cloud provider");
    if (!config.whatsapp.phoneNumberId)
      errors.push("PHONE_NUMBER_ID is required for cloud provider");
    if (!config.whatsapp.verifyToken)
      errors.push("VERIFY_TOKEN is required for cloud provider");
  } else if (config.messagingProvider === "wasender") {
    if (!config.wasender.apiKey)
      errors.push("WASENDER_API_KEY is required for wasender provider");
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join("\n")}`);
  }
}

// Validate configuration on module load
validateConfig();

module.exports = config;
