const axios = require("axios");
const config = require("../../lib/config");
const logger = require("../../lib/logger");

/**
 * WaSender API provider implementation
 * Sends messages via WaSender API
 */
class WaSenderProvider {
  constructor() {
    this.baseUrl = config.wasender.baseUrl;
    this.apiKey = config.wasender.apiKey;
  }

  /**
   * Send text message via WaSender API
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} API response
   */
  async sendText(to, text) {
    try {
      // Format phone number (remove + if present, ensure proper format)
      const formattedPhone = to.replace(/^\+/, "");

      const payload = {
        to: formattedPhone,
        text: text,
      };

      logger.info("Sending message via WaSender", {
        provider: "wasender",
        to: formattedPhone,
        messageLength: text.length,
        payload,
      });

      // Mock response for testing (when using test API key)
      if (this.apiKey === "test_api_key_here") {
        logger.info("Mock message sent (test mode)", {
          provider: "wasender",
          to: formattedPhone,
          messageLength: text.length,
        });
        return { success: true, message: "Mock message sent" };
      }

      const response = await axios.post(
        `${this.baseUrl}/send-message`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      logger.info("Message sent via WaSender", {
        provider: "wasender",
        to: formattedPhone,
        messageLength: text.length,
        status: response.status,
        responseData: response.data,
      });

      return response.data;
    } catch (error) {
      logger.error("Failed to send message via WaSender", error, {
        provider: "wasender",
        to,
        messageLength: text.length,
        responseData: error.response?.data,
      });

      // Handle rate limiting
      if (error.response?.status === 429) {
        const retryAfter = error.response.data?.retry_after || 60;
        throw new Error(`Rate limited. Try again in ${retryAfter} seconds.`);
      }

      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

module.exports = WaSenderProvider;
