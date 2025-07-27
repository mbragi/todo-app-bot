const config = require("../lib/config");
const logger = require("../lib/logger");
const WaSenderProvider = require("./providers/wasender");
const CloudProvider = require("./providers/cloud");

/**
 * WhatsApp client factory
 * Returns appropriate provider based on MESSAGING_PROVIDER configuration
 * @returns {WaSenderProvider|CloudProvider} Provider instance
 */
function createWhatsAppClient() {
  const provider = config.messagingProvider;

  logger.info("Creating WhatsApp client", { provider });

  switch (provider) {
    case "cloud":
      return new CloudProvider();
    case "wasender":
    default:
      return new WaSenderProvider();
  }
}

module.exports = {
  createWhatsAppClient,
};
