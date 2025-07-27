const axios = require("axios");
const config = require("../../lib/config");
const logger = require("../../lib/logger");

/**
 * WhatsApp Cloud API provider implementation
 * Sends messages via Meta's WhatsApp Business API
 */
class CloudProvider {
  constructor() {
    this.token = config.whatsapp.token;
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.baseUrl = "https://graph.facebook.com/v18.0";
  }

  /**
   * Send text message via WhatsApp Cloud API
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} API response
   */
  async sendText(to, text) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to: to,
          type: "text",
          text: {
            body: text,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info("Message sent via WhatsApp Cloud API", {
        provider: "cloud",
        to,
        messageLength: text.length,
        messageId: response.data?.messages?.[0]?.id,
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to send message via WhatsApp Cloud API", error, {
        provider: "cloud",
        to,
        messageLength: text.length,
      });

      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

module.exports = CloudProvider;
