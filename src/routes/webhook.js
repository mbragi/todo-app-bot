const express = require("express");
const router = express.Router();
const config = require("../lib/config");
const logger = require("../lib/logger");
const { createWhatsAppClient } = require("../whatsapp/client");

/**
 * Webhook verification for WhatsApp Cloud API
 * GET /webhook?hub.mode=subscribe&hub.challenge=CHALLENGE_ACCEPTED&hub.verify_token=VERIFY_TOKEN
 */
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  logger.info("Webhook verification request", {
    mode,
    token: token ? "present" : "missing",
    challenge: challenge ? "present" : "missing",
  });

  // Check if a token and mode were sent
  if (mode && token) {
    // Check the mode and token sent are correct
    if (mode === "subscribe" && token === config.whatsapp.verifyToken) {
      // Respond with 200 OK and challenge token from the request
      logger.info("Webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      logger.warn("Webhook verification failed - invalid token or mode");
      res.sendStatus(403);
    }
  } else {
    logger.warn("Webhook verification failed - missing parameters");
    res.sendStatus(400);
  }
});

/**
 * Webhook endpoint for receiving messages
 * POST /webhook
 */
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    logger.info("Webhook received", {
      object: body.object,
      entryCount: body.entry?.length || 0,
    });

    // Check if this is a WhatsApp message
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from;
        const text = message.text?.body || "";

        logger.info("Message received", {
          from,
          text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          messageType: message.type,
        });

        // Echo functionality for now
        if (text.toLowerCase() === "hi" || text.toLowerCase() === "hello") {
          const whatsappClient = createWhatsAppClient();
          await whatsappClient.sendText(
            from,
            "Hello! WhatsApp assistant online."
          );

          logger.info("Echo response sent", { to: from });
        }
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    logger.error("Error processing webhook", error, {
      body: req.body,
      headers: req.headers,
    });
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
