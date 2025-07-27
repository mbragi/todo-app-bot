const express = require("express");
const router = express.Router();
const {
  getAuthUrl,
  exchangeCodeForTokens,
} = require("../calendar/googleOAuth");
const logger = require("../lib/logger");

/**
 * Start OAuth flow - redirect user to Google
 * GET 
 * 
 */
router.get("/start", (req, res) => {
  try {
    const { uid } = req.query;

    if (!uid) {
      logger.warn("OAuth start missing uid parameter");
      return res.status(400).json({ error: "Missing uid parameter" });
    }

    const authUrl = getAuthUrl(uid);

    logger.info("OAuth flow started", { uid });

    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    logger.error("Error starting OAuth flow", error);
    res.status(500).json({ error: "Failed to start OAuth flow" });
  }
});

/**
 * OAuth callback - handle Google's response
 * GET /oauth/google/callback?code=...&state=...
 */
router.get("/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      logger.warn("OAuth callback error", { error });
      return res.status(400).json({
        error: "OAuth authorization was denied or failed",
        details: error,
      });
    }

    if (!code || !state) {
      logger.warn("OAuth callback missing parameters", {
        hasCode: !!code,
        hasState: !!state,
      });
      return res
        .status(400)
        .json({ error: "Missing authorization code or state" });
    }

    // Decode uid from state
    let uid;
    try {
      uid = Buffer.from(state, "base64").toString();
    } catch (decodeError) {
      logger.error("Failed to decode state parameter", decodeError, { state });
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    // Exchange code for tokens
    await exchangeCodeForTokens(code, uid);

    logger.info("OAuth callback completed successfully", { uid });

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Calendar Connected!</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
              max-width: 400px; 
              margin: 0 auto; 
            }
            .success { color: #28a745; font-size: 24px; }
            .message { margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success">✅</div>
            <h2>Google Calendar Connected!</h2>
            <div class="message">
              Your Google Calendar has been successfully linked to your WhatsApp assistant.
            </div>
            <div class="message">
              You can now close this window and return to WhatsApp.
            </div>
            <div class="message">
              Try typing "agenda" to see your daily schedule!
            </div>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    logger.error("Error in OAuth callback", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              text-align: center; 
              padding: 50px; 
              background: #f5f5f5; 
            }
            .container { 
              background: white; 
              padding: 30px; 
              border-radius: 10px; 
              box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
              max-width: 400px; 
              margin: 0 auto; 
            }
            .error { color: #dc3545; font-size: 24px; }
            .message { margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌</div>
            <h2>Connection Failed</h2>
            <div class="message">
              Sorry, we couldn't connect your Google Calendar at this time.
            </div>
            <div class="message">
              Please try again later or contact support if the problem persists.
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

module.exports = router;
