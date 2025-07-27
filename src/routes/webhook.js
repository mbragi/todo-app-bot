const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const config = require("../lib/config");
const logger = require("../lib/logger");
const { createWhatsAppClient } = require("../whatsapp/client");
const {
  addUserIfNew,
  getSettings,
  setSettings,
  getUserProfile,
  hasCompletedOnboarding,
  hasGoogleCalendarLinked,
} = require("../users/service");
const { listEvents } = require("../calendar/googleCalendar");
const { tryHandle, startOnboarding } = require("../users/onboarding");
const { getAuthUrl } = require("../calendar/googleOAuth");

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
 * Verify webhook signature
 * @param {string} signature - Signature header
 * @param {string} body - Request body
 * @param {string} secret - Webhook secret
 * @returns {boolean} - true if signature is valid
 */
function verifyWebhookSignature(signature, rawBody, secret) {
  if (!signature || !secret) {
    logger.warn("Missing signature or secret", {
      hasSignature: !!signature,
      hasSecret: !!secret,
    });
    return false;
  }

  try {
    // Calculate signature from raw body
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Handle different signature formats
    let receivedSignature = signature;
    if (signature.startsWith("sha256=")) {
      receivedSignature = signature.replace("sha256=", "");
    }

    const match = receivedSignature === expectedSignature;

    if (!match) {
      logger.warn("Signature mismatch", {
        received: receivedSignature.substring(0, 8) + "...",
        expected: expectedSignature.substring(0, 8) + "...",
      });
    } else {
      logger.info("Signature verified");
    }

    return match;
  } catch (error) {
    logger.error("Error verifying webhook signature", error);
    return false;
  }
}

/**
 * Webhook endpoint for receiving messages
 * POST /webhook
 */
router.post("/", async (req, res) => {
  try {
    // Debug: Log entire request
    console.log("=== WEBHOOK DEBUG ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));
    console.log("Raw URL:", req.url);
    console.log("Method:", req.method);
    console.log("=====================");

    // Get raw body for signature verification
    const rawBody = JSON.stringify(req.body);
    const body = req.body;

    // Verify webhook signature using raw body
    const signature = req.headers["X-Webhook-Signature"];
    const secret =
      config.messagingProvider === "cloud"
        ? config.whatsapp.webhookSecret
        : config.wasender.webhookSecret;

    if (secret && !verifyWebhookSignature(signature, rawBody, secret)) {
      logger.warn("Invalid webhook signature", {
        hasSignature: !!signature,
        hasSecret: !!secret,
        provider: config.messagingProvider,
      });

      // For testing, allow bypass if signature verification fails
      // Remove this in production
      if (process.env.NODE_ENV === "development") {
        logger.warn("Bypassing signature verification in development mode");
      } else {
        return res.status(401).send("Unauthorized");
      }
    }

    logger.info("Webhook received", {
      event: body.event || "unknown",
      type: body.object || "direct",
      signatureVerified: !!secret,
      hasData: !!body.data,
      dataKeys: body.data ? Object.keys(body.data) : [],
    });

    // Check if this is a WhatsApp message (support multiple formats)
    let message = null;
    let from = null;
    let text = "";

    // Format 1: WhatsApp Cloud API
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages && value.messages.length > 0) {
        message = value.messages[0];
        from = message.from;
        text = message.text?.body || "";
      }
    }
    // Format 2: Direct messages array (some providers)
    else if (body.messages && body.messages.length > 0) {
      message = body.messages[0];
      from = message.from || message.sender || message.phone;
      text = message.text || message.body || message.message || "";
    }
    // Format 3: WaSender format
    else if (body.data && body.data.messages && body.data.messages.length > 0) {
      message = body.data.messages[0];
      from = message.from || message.sender;
      text = message.text || message.body || "";
    }
    // Format 4: WaSender event webhooks
    else if (
      body.event &&
      (body.event.startsWith("message.") || body.event.startsWith("messages."))
    ) {
      logger.info("Message event", { event: body.event });

      // Process received messages and upserts (new messages)
      console.log("=== MESSAGE PROCESSING DEBUG ===");
      console.log("Event:", body.event);
      console.log("Has data:", !!body.data);
      console.log("Data keys:", body.data ? Object.keys(body.data) : []);
      console.log("Has messages:", !!(body.data && body.data.messages));
      console.log(
        "Messages type:",
        body.data && body.data.messages ? typeof body.data.messages : "N/A"
      );
      console.log(
        "Messages content:",
        body.data && body.data.messages
          ? JSON.stringify(body.data.messages, null, 2)
          : "N/A"
      );
      console.log("================================");

      if (
        (body.event === "message.received" ||
          body.event === "messages.upsert" ||
          body.event === "messages.received") &&
        body.data &&
        body.data.messages &&
        body.data.messages.key &&
        body.data.messages.message
      ) {
        // Extract from WaSender messages object format
        const messageData = body.data.messages;
        from = messageData.key.remoteJid;

        // Extract text from different message types
        let text = "";
        if (messageData.message.conversation) {
          text = messageData.message.conversation;
        } else if (
          messageData.message.extendedTextMessage &&
          messageData.message.extendedTextMessage.text
        ) {
          text = messageData.message.extendedTextMessage.text;
        } else if (messageData.message.text) {
          text = messageData.message.text;
        }

        logger.info("Message extracted", {
          from,
          text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
          event: body.event,
          messageType: Object.keys(messageData.message)[0],
        });

        // Only process messages that match our commands
        const trimmedText = text.trim().toLowerCase();
        const isCommand =
          trimmedText === "connect" ||
          trimmedText === "agenda" ||
          trimmedText === "help" ||
          trimmedText === "whoami" ||
          trimmedText.startsWith("set tz ") ||
          trimmedText === "hi" ||
          trimmedText === "hello";

        if (!isCommand) {
          logger.info("Ignoring non-command message", { text: trimmedText });
          return res.status(200).send("OK");
        }
      } else {
        // Acknowledge other message events but don't process them
        logger.info("Event acknowledged", { event: body.event });
        return res.status(200).send("OK");
      }
    }
    // Format 5: WaSender test webhook
    else if (body.event === "webhook.test") {
      logger.info("Test webhook received");
      // Don't process test webhooks as messages, just acknowledge
      return res.status(200).send("OK");
    }

    // Process message if we found one
    if (message && from && text) {
      logger.info("Message received", {
        from,
        text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
        messageType: message.type,
      });

      // User management
      const uid = from; // E.164 from the provider payload
      const isNewUser = await addUserIfNew(uid);

      const msg = (text || "").trim();
      const lower = msg.toLowerCase();

      const whatsappClient = createWhatsAppClient();

      // Handle new user onboarding
      if (isNewUser) {
        const onboardingResponse = startOnboarding(uid);
        await whatsappClient.sendText(uid, onboardingResponse.message);
        logger.info("Started onboarding for new user", { uid });
        return;
      }

      // Check if user has completed onboarding
      const hasOnboarded = await hasCompletedOnboarding(uid);
      if (!hasOnboarded) {
        // Handle onboarding flow
        const onboardingResponse = await tryHandle(uid, msg);
        if (onboardingResponse) {
          await whatsappClient.sendText(uid, onboardingResponse.message);
          return;
        }
      }

      // Get user profile for personalized responses
      const profile = await getUserProfile(uid);

      // Command handling
      if (lower === "hi" || lower === "hello") {
        const greeting = profile ? `Hello ${profile.name}! 👋` : "Hello! 👋";
        await whatsappClient.sendText(uid, greeting);
        logger.info("Greeting sent", { to: uid });
      }
      // Connect command
      else if (lower === "connect") {
        const isLinked = await hasGoogleCalendarLinked(uid);
        if (isLinked) {
          await whatsappClient.sendText(
            uid,
            "✅ Your Google Calendar is already connected!"
          );
        } else {
          const authUrl = getAuthUrl(uid);
          await whatsappClient.sendText(
            uid,
            `🔗 Connect your Google Calendar:\n\n${authUrl}\n\nClick the link above to authorize access to your calendar.`
          );
          logger.info("OAuth URL sent", { uid });
        }
      }
      // Agenda command
      else if (lower === "agenda") {
        const isLinked = await hasGoogleCalendarLinked(uid);
        if (!isLinked) {
          await whatsappClient.sendText(
            uid,
            "📅 You're not connected to Google Calendar yet.\n\nType 'connect' to link your calendar and see your agenda."
          );
          return;
        }

        try {
          const events = await listEvents(uid, new Date());
          if (!events.length) {
            await whatsappClient.sendText(
              uid,
              "📅 No events scheduled for today 👍"
            );
          } else {
            const lines = events.map((e) => {
              const hhmm = (e.start || "").substring(11, 16) || "All-day";
              return `• ${hhmm} — ${e.summary}`;
            });
            await whatsappClient.sendText(
              uid,
              `📅 Today's agenda:\n\n${lines.join("\n")}`
            );
          }
          logger.info("Agenda sent", { to: uid, eventCount: events.length });
        } catch (error) {
          logger.error("Failed to fetch agenda", error, { to: uid });
          await whatsappClient.sendText(
            uid,
            "❌ Sorry, couldn't fetch your calendar. Please try 'connect' again if needed."
          );
        }
      }
      // Help command
      else if (lower === "help") {
        const helpText = `🤖 Available commands:

• connect - Link your Google Calendar
• agenda - View today's schedule
• set tz <timezone> - Set your timezone (e.g., "set tz America/New_York")
• whoami - Show your profile info
• help - Show this help message

Need help? Just ask!`;
        await whatsappClient.sendText(uid, helpText);
      }
      // Whoami command
      else if (lower === "whoami") {
        if (profile) {
          const isLinked = await hasGoogleCalendarLinked(uid);
          const status = isLinked ? "✅ Connected" : "❌ Not connected";
          const whoamiText = `👤 Your Profile:
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone || "Not provided"}
Calendar: ${status}`;
          await whatsappClient.sendText(uid, whoamiText);
        } else {
          await whatsappClient.sendText(
            uid,
            "❌ Profile not found. Please complete onboarding."
          );
        }
      }
      // Settings commands
      else if (lower.startsWith("set tz ")) {
        const tz = msg.slice(7).trim();
        await setSettings(uid, { tz });
        const s = await getSettings(uid);
        await whatsappClient.sendText(uid, `⏰ Timezone updated → ${s.tz}`);
        logger.info("Timezone updated", { to: uid, tz: s.tz });
      }
      // Default response
      else {
        await whatsappClient.sendText(
          uid,
          "🤔 I didn't understand that. Type 'help' to see available commands."
        );
      }
    } else {
      logger.info("No message to process");
    }

    // Always respond with OK to webhook
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
