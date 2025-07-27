const express = require("express");
const router = express.Router();
const logger = require("../lib/logger");
const { createWhatsAppClient } = require("../whatsapp/client");

/**
 * Send message endpoint for testing
 * POST /send
 * Body: { "to": "+1234567890", "text": "Hello world" }
 */
router.post("/", async (req, res) => {
  try {
    const { to, text } = req.body;

    // Validate input
    if (!to || !text) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["to", "text"],
        received: { to, text },
      });
    }

    logger.info("Send message request", {
      to,
      textLength: text.length,
      text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
    });

    // Send message
    const whatsappClient = createWhatsAppClient();
    const result = await whatsappClient.sendText(to, text);

    logger.info("Message sent successfully", {
      to,
      result,
    });

    res.json({
      success: true,
      message: "Message sent successfully",
      to,
      result,
    });
  } catch (error) {
    logger.error("Failed to send message", error, {
      to: req.body?.to,
      textLength: req.body?.text?.length,
    });

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
