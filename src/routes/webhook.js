const express = require("express");
const router = express.Router();
const config = require("../lib/config");
const logger = require("../lib/logger");
const { createWhatsAppClient } = require("../whatsapp/client");
const { addUserIfNew, getSettings, setSettings } = require("../users/service");
const { listEvents } = require("../calendar/googleCalendar");

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

        // User management
        const uid = from; // E.164 from the provider payload
        await addUserIfNew(uid);

        const msg = (text || "").trim();
        const lower = msg.toLowerCase();

        // Echo functionality
        if (lower === "hi" || lower === "hello") {
          const whatsappClient = createWhatsAppClient();
          await whatsappClient.sendText(
            uid,
            "Hello! WhatsApp assistant online."
          );
          logger.info("Echo response sent", { to: uid });
        }
        // Agenda command
        else if (lower === "agenda") {
          const whatsappClient = createWhatsAppClient();
          try {
            const events = await listEvents(uid, new Date());
            if (!events.length) {
              await whatsappClient.sendText(uid, "No events today 👍");
            } else {
              const lines = events.map((e) => {
                const hhmm = (e.start || "").substring(11, 16) || "All-day";
                return `• ${hhmm} — ${e.summary}`;
              });
              await whatsappClient.sendText(uid, `Today:\n${lines.join("\n")}`);
            }
            logger.info("Agenda sent", { to: uid, eventCount: events.length });
          } catch (error) {
            logger.error("Failed to fetch agenda", error, { to: uid });
            await whatsappClient.sendText(
              uid,
              "Sorry, couldn't fetch your calendar. Please check your Google Calendar settings."
            );
          }
        }
        // Settings commands
        else if (lower.startsWith("set tz ")) {
          const whatsappClient = createWhatsAppClient();
          const tz = msg.slice(7).trim();
          await setSettings(uid, { tz });
          const s = await getSettings(uid);
          await whatsappClient.sendText(uid, `Timezone updated → ${s.tz}`);
          logger.info("Timezone updated", { to: uid, tz: s.tz });
        } else if (lower.startsWith("set calendar ")) {
          const whatsappClient = createWhatsAppClient();
          const calendarId = msg.slice("set calendar ".length).trim();
          await setSettings(uid, { calendarId });
          const s = await getSettings(uid);
          await whatsappClient.sendText(
            uid,
            `Calendar ID updated → ${s.calendarId}`
          );
          logger.info("Calendar ID updated", {
            to: uid,
            calendarId: s.calendarId,
          });
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
