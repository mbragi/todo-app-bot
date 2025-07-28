const config = require("../lib/config");
const logger = require("../lib/logger");
const WaSenderProvider = require("./providers/wasender");

/**
 * WhatsApp client factory
 * Returns WaSender provider (only provider supported)
 * @returns {WaSenderProvider} Provider instance
 */
function createWhatsAppClient() {
  logger.info("Creating WhatsApp client", { provider: "wasender" });
  return new WaSenderProvider();
}

module.exports = {
  createWhatsAppClient,
};
