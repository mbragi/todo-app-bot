const { google } = require("googleapis");
const config = require("../lib/config");
const store = require("../store");
const logger = require("../lib/logger");

/**
 * Create OAuth2 client for Google Calendar
 * @returns {google.auth.OAuth2} - OAuth2 client instance
 */
function createOAuth2Client() {
  return new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );
}

/**
 * Generate authorization URL for Google OAuth
 * @param {string} uid - User ID (phone number)
 * @returns {string} - Authorization URL
 */
function getAuthUrl(uid) {
  const oauth2Client = createOAuth2Client();

  const scopes = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
  ];

  const state = Buffer.from(uid).toString("base64"); // Encode uid in state

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    state: state,
    prompt: "consent", // Force consent to get refresh token
  });

  logger.info("Generated OAuth URL", { uid, hasState: !!state });

  return authUrl;
}

/**
 * Exchange authorization code for tokens
 * @param {string} code - Authorization code from Google
 * @param {string} uid - User ID (decoded from state)
 * @returns {Object} - Token response with access_token and refresh_token
 */
async function exchangeCodeForTokens(code, uid) {
  try {
    const oauth2Client = createOAuth2Client();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      throw new Error("No refresh token received from Google");
    }

    // Store tokens in memory
    const gcalKey = `user:${uid}:gcal`;
    await store.hset(gcalKey, "refresh_token", tokens.refresh_token);
    await store.hset(gcalKey, "access_token", tokens.access_token);

    // Get user info from Google and update profile
    try {
      const { google } = require("googleapis");
      const oauth2Client = createOAuth2Client();
      oauth2Client.setCredentials(tokens);

      const people = google.people({ version: "v1", auth: oauth2Client });
      const userInfo = await people.people.get({
        resourceName: "people/me",
        personFields: "emailAddresses",
      });

      const email = userInfo.data.emailAddresses?.[0]?.value;
      if (email) {
        // Update user profile with email from Google
        const { saveUserProfile } = require("../users/service");
        const profile = await getUserProfile(uid);
        if (profile) {
          await saveUserProfile(uid, { ...profile, email });
        }

        // Set calendar ID to user's email
        const settingsKey = `user:${uid}:settings`;
        await store.hset(settingsKey, "calendarId", email);

        logger.info("User email updated from Google", { uid, email });
      }
    } catch (error) {
      logger.warn("Failed to get user email from Google", {
        uid,
        error: error.message,
      });
    }

    logger.info("OAuth tokens stored successfully", {
      uid,
      hasRefreshToken: !!tokens.refresh_token,
      hasAccessToken: !!tokens.access_token,
    });

    return tokens;
  } catch (error) {
    logger.error("Failed to exchange code for tokens", error, { uid });
    throw error;
  }
}

/**
 * Get OAuth2 client for a specific user
 * @param {string} uid - User ID
 * @returns {google.auth.OAuth2} - OAuth2 client with user's tokens
 */
async function getUserOAuth2Client(uid) {
  const gcalKey = `user:${uid}:gcal`;
  const refreshToken = await store.hget(gcalKey, "refresh_token");

  if (!refreshToken) {
    throw new Error("User not connected to Google Calendar");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  return oauth2Client;
}

/**
 * Refresh access token for a user
 * @param {string} uid - User ID
 * @returns {string} - New access token
 */
async function refreshAccessToken(uid) {
  try {
    const oauth2Client = await getUserOAuth2Client(uid);
    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update stored access token
    const gcalKey = `user:${uid}:gcal`;
    await store.hset(gcalKey, "access_token", credentials.access_token);

    return credentials.access_token;
  } catch (error) {
    logger.error("Failed to refresh access token", error, { uid });
    throw error;
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  getUserOAuth2Client,
  refreshAccessToken,
};
