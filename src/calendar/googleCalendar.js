const { google } = require("googleapis");
const { getSettings, hasGoogleCalendarLinked } = require("../users/service");
const { getUserOAuth2Client, refreshAccessToken } = require("./googleOAuth");

/**
 * Get authentication for a specific user
 * @param {string} uid - User ID
 * @returns {google.auth.OAuth2} - OAuth2 client
 */
async function getUserAuth(uid) {
  // Check if user has Google Calendar linked
  if (!(await hasGoogleCalendarLinked(uid))) {
    throw new Error("User not connected to Google Calendar");
  }

  try {
    return await getUserOAuth2Client(uid);
  } catch (error) {
    // Try to refresh the token
    await refreshAccessToken(uid);
    return await getUserOAuth2Client(uid);
  }
}

function getCalendarClient(auth) {
  return google.calendar({ version: "v3", auth });
}

/**
 * List events for a given user and date.
 * @param {string} uid  WhatsApp sender (E.164)
 * @param {Date} date   JS Date (we take the local-day window)
 */
async function listEvents(uid, date) {
  const { tz, calendarId } = await getSettings(uid);
  const auth = await getUserAuth(uid);
  const calendar = getCalendarClient(auth);

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const res = await calendar.events.list({
    calendarId,
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    timeZone: tz,
  });

  const items = res.data.items || [];
  return items.map((e) => ({
    id: e.id,
    summary: e.summary || "(no title)",
    location: e.location || "",
    start: e.start.dateTime || e.start.date,
    end: e.end.dateTime || e.end.date,
  }));
}

module.exports = { listEvents };
