const { google } = require("googleapis");
const { getSettings } = require("../users/service");

// Service Account auth (MVP). For OAuth per-user later, read a user refresh_token
// from user:{uid}:gcal and construct an OAuth2 client instead.
function buildAuth() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });
  }
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    return new google.auth.JWT(creds.client_email, null, creds.private_key, [
      "https://www.googleapis.com/auth/calendar",
    ]);
  }
  throw new Error(
    "No Google credentials. Set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CREDENTIALS_JSON."
  );
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
  const auth = await buildAuth();
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
