const axios = require("axios");
const config = require("../../lib/config");
const logger = require("../../lib/logger");

/**
 * WaSender API provider implementation
 * Sends messages via WaSender API with retry logic
 */
class WaSenderProvider {
  constructor() {
    this.baseUrl = config.wasender.baseUrl;
    this.apiKey = config.wasender.apiKey;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second base delay
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Send text message via WaSender API with retry logic
   * @param {string} to - Recipient phone number
   * @param {string} text - Message text
   * @returns {Promise<Object>} API response
   */
  async sendText(to, text) {
    let lastError = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
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
          attempt,
          maxRetries: this.maxRetries,
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
            timeout: 10000, // 10 second timeout
          }
        );

        logger.info("Message sent via WaSender", {
          provider: "wasender",
          to: formattedPhone,
          messageLength: text.length,
          status: response.status,
          responseData: response.data,
          attempt,
        });

        return response.data;
      } catch (error) {
        lastError = error;

        // Handle rate limiting specifically - retry after the specified delay
        if (error.response?.status === 429) {
          const retryAfter = error.response.data?.retry_after || 60;
          const message = error.response.data?.message || "Rate limited";

          if (attempt < this.maxRetries) {
            logger.warn("Rate limited by WaSender - will retry after delay", {
              provider: "wasender",
              to,
              retryAfter,
              message,
              attempt,
              maxRetries: this.maxRetries,
            });
            await this.sleep(retryAfter * 1000); // Convert seconds to milliseconds
            continue;
          } else {
            logger.error("Rate limited by WaSender - max retries reached", {
              provider: "wasender",
              to,
              retryAfter,
              message,
              attempt,
            });
            throw new Error(
              `Rate limited. Try again in ${retryAfter} seconds.`
            );
          }
        }

        // Handle other HTTP errors that might be retryable
        if (error.response) {
          const status = error.response.status;

          // Don't retry on client errors (4xx) except 408, 429
          if (
            status >= 400 &&
            status < 500 &&
            status !== 408 &&
            status !== 429
          ) {
            logger.error("WaSender API client error - not retrying", {
              provider: "wasender",
              to,
              status,
              data: error.response.data,
              attempt,
            });
            throw new Error(
              `API error: ${status} - ${
                error.response.data?.message || error.message
              }`
            );
          }

          // Retry on server errors (5xx) and 408
          if (status >= 500 || status === 408) {
            if (attempt < this.maxRetries) {
              const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
              logger.warn("WaSender API server error - retrying", {
                provider: "wasender",
                to,
                status,
                attempt,
                maxRetries: this.maxRetries,
                delay,
              });
              await this.sleep(delay);
              continue;
            }
          }

          logger.error("WaSender API error", {
            provider: "wasender",
            to,
            status,
            data: error.response.data,
            attempt,
          });
          throw new Error(
            `API error: ${status} - ${
              error.response.data?.message || error.message
            }`
          );
        }

        // Handle network/timeout errors - retry these
        if (
          error.code === "ECONNABORTED" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ECONNRESET" ||
          error.code === "ENOTFOUND"
        ) {
          if (attempt < this.maxRetries) {
            const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
            logger.warn("WaSender network error - retrying", {
              provider: "wasender",
              to,
              error: error.message,
              attempt,
              maxRetries: this.maxRetries,
              delay,
            });
            await this.sleep(delay);
            continue;
          }
        }

        // Handle other errors
        logger.error("Failed to send message via WaSender", {
          provider: "wasender",
          to,
          messageLength: text.length,
          error: error.message,
          responseData: error.response?.data,
          attempt,
        });

        throw new Error(`Failed to send message: ${error.message}`);
      }
    }

    // If we get here, all retries failed
    logger.error("All retries failed for WaSender message", {
      provider: "wasender",
      to,
      messageLength: text.length,
      maxRetries: this.maxRetries,
      lastError: lastError?.message,
    });

    throw new Error(
      `Failed to send message after ${this.maxRetries} attempts: ${
        lastError?.message || "Unknown error"
      }`
    );
  }
}

module.exports = WaSenderProvider;
