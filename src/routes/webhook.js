const express = require("express");
const router = express.Router();
const config = require("../lib/config");
const logger = require("../lib/logger");
const store = require("../store");
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
 * Helper function to send WhatsApp messages with rate limiting error handling
 */
async function sendMessageSafely(whatsappClient, uid, message) {
  try {
    await whatsappClient.sendText(uid, message);
  } catch (error) {
    if (error.message.includes("Rate limited")) {
      logger.warn("Rate limited when sending message", {
        uid,
        error: error.message,
      });
      // Don't crash the webhook, just acknowledge
      return false;
    }
    throw error;
  }
  return true;
}

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
      event: body.event || "unknown",
      type: body.object || "direct",
      hasData: !!body.data,
      dataKeys: body.data ? Object.keys(body.data) : [],
    });

    // Extract WaSender message data
    let from = null;
    let text = "";

    // Handle WaSender event webhooks
    if (
      body.event &&
      (body.event.startsWith("message.") || body.event.startsWith("messages."))
    ) {
      // Process received messages and upserts (new messages)
      if (
        (body.event === "message.received" ||
          body.event === "messages.upsert" ||
          body.event === "messages.received") &&
        body.data &&
        body.data.messages
      ) {
        if (body.data.messages.key && body.data.messages.message) {
          // Extract from WaSender messages object format
          const messageData = body.data.messages;
          from = messageData.key.remoteJid;

          // Extract text from different message types
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
            return res.status(200).send("OK");
          }
        } else {
          // Acknowledge other message events but don't process them
          return res.status(200).send("OK");
        }
      } else {
        // Acknowledge other message events but don't process them
        return res.status(200).send("OK");
      }
    }
    // Handle WaSender test webhook
    else if (body.event === "webhook.test") {
      return res.status(200).send("OK");
    }

    // Process message if we found one
    if (from && text) {
      logger.info("Message received", {
        from,
        text: text.substring(0, 50) + (text.length > 50 ? "..." : ""),
      });

      // User management
      const uid = from; // E.164 from the provider payload
      const isNewUser = await addUserIfNew(uid);

      const msg = (text || "").trim();
      const lower = msg.toLowerCase();

      const whatsappClient = createWhatsAppClient();

      // Check if user has completed onboarding FIRST
      const hasOnboarded = await hasCompletedOnboarding(uid);
      if (!hasOnboarded) {
        // Handle onboarding flow - this takes priority over all commands
        const onboardingResponse = await tryHandle(uid, msg);
        if (onboardingResponse) {
          try {
            await whatsappClient.sendText(uid, onboardingResponse.message);
          } catch (error) {
            if (error.message.includes("Rate limited")) {
              logger.warn("Rate limited during onboarding", {
                uid,
                error: error.message,
              });
              // Don't crash the webhook, just acknowledge
              return res.status(200).send("OK");
            }
            throw error;
          }
          return;
        }
      }

      // Handle new user onboarding (only if not already in onboarding)
      if (isNewUser) {
        const onboardingResponse = startOnboarding(uid);
        try {
          await whatsappClient.sendText(uid, onboardingResponse.message);
        } catch (error) {
          if (error.message.includes("Rate limited")) {
            logger.warn("Rate limited during new user onboarding", {
              uid,
              error: error.message,
            });
            return res.status(200).send("OK");
          }
          throw error;
        }
        logger.info("Started onboarding for new user", { uid });
        return;
      }

      // Get user profile for personalized responses
      const profile = await getUserProfile(uid);

      // Simple rate limiting - prevent sending messages too frequently
      const lastMessageKey = `last_message:${uid}`;
      const lastMessageTime = store.get(lastMessageKey);
      const now = Date.now();
      const minInterval = 60000; // 1 minute minimum between messages

      if (lastMessageTime && now - lastMessageTime < minInterval) {
        logger.info("Rate limiting message", {
          uid,
          timeSinceLast: now - lastMessageTime,
        });
        return res.status(200).send("OK");
      }

      // Update last message time
      store.set(lastMessageKey, now);

      // Command handling
      if (lower === "hi" || lower === "hello") {
        const greeting = profile ? `Hello ${profile.name}! 👋` : "Hello! 👋";
        await sendMessageSafely(whatsappClient, uid, greeting);
        logger.info("Greeting sent", { to: uid });
      }
      // Connect command
      else if (lower === "connect") {
        const isLinked = await hasGoogleCalendarLinked(uid);
        if (isLinked) {
          await sendMessageSafely(
            whatsappClient,
            uid,
            "✅ Your Google Calendar is already connected!"
          );
        } else {
          const authUrl = getAuthUrl(uid);
          await sendMessageSafely(
            whatsappClient,
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
          await sendMessageSafely(
            whatsappClient,
            uid,
            "📅 You're not connected to Google Calendar yet.\n\nType 'connect' to link your calendar and see your agenda."
          );
          return;
        }

        try {
          const events = await listEvents(uid, new Date());
          if (!events.length) {
            await sendMessageSafely(
              whatsappClient,
              uid,
              "📅 No events scheduled for today 👍"
            );
          } else {
            const lines = events.map((e) => {
              const hhmm = (e.start || "").substring(11, 16) || "All-day";
              return `• ${hhmm} — ${e.summary}`;
            });
            await sendMessageSafely(
              whatsappClient,
              uid,
              `📅 Today's agenda:\n\n${lines.join("\n")}`
            );
          }
          logger.info("Agenda sent", { to: uid, eventCount: events.length });
        } catch (error) {
          logger.error("Failed to fetch agenda", error, { to: uid });
          await sendMessageSafely(
            whatsappClient,
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
        await sendMessageSafely(whatsappClient, uid, helpText);
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
          await sendMessageSafely(whatsappClient, uid, whoamiText);
        } else {
          await sendMessageSafely(
            whatsappClient,
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
        await sendMessageSafely(
          whatsappClient,
          uid,
          `⏰ Timezone updated → ${s.tz}`
        );
        logger.info("Timezone updated", { to: uid, tz: s.tz });
      }
      // Default response
      else {
        await sendMessageSafely(
          whatsappClient,
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
