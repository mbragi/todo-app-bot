const store = require("../store");

const USERS_SET = "users:set";

/**
 * Add user to the system if they don't exist
 * @param {string} uid - User ID (phone number)
 * @returns {boolean} - true if user was newly added, false if already existed
 */
async function addUserIfNew(uid) {
  if (!store.sismember(USERS_SET, uid)) {
    store.sadd(USERS_SET, uid);
    // Set default settings
    const settingsKey = `user:${uid}:settings`;
    if (!store.hget(settingsKey, "tz"))
      store.hset(settingsKey, "tz", process.env.TZ || "Africa/Lagos");
    if (!store.hget(settingsKey, "calendarId"))
      store.hset(settingsKey, "calendarId", "primary");
    return true; // New user
  }
  return false; // Existing user
}

async function getSettings(uid) {
  const key = `user:${uid}:settings`;
  const all = store.hgetall(key);
  return {
    tz: all.tz || process.env.TZ || "Africa/Lagos",
    calendarId: all.calendarId || process.env.GOOGLE_CALENDAR_ID || "primary",
  };
}

async function setSettings(uid, partial) {
  const key = `user:${uid}:settings`;
  if (partial.tz) store.hset(key, "tz", partial.tz);
  if (partial.calendarId) store.hset(key, "calendarId", partial.calendarId);
  return getSettings(uid);
}

/**
 * Get user profile information
 * @param {string} uid - User ID
 * @returns {Object|null} - User profile or null if not found
 */
async function getUserProfile(uid) {
  const profileKey = `user:${uid}:profile`;
  const profile = store.hgetall(profileKey);
  return Object.keys(profile).length > 0 ? profile : null;
}

/**
 * Save user profile information
 * @param {string} uid - User ID
 * @param {Object} profile - Profile data {name, email, phone}
 */
async function saveUserProfile(uid, profile) {
  const profileKey = `user:${uid}:profile`;
  if (profile.name) store.hset(profileKey, "name", profile.name);
  if (profile.email) store.hset(profileKey, "email", profile.email);
  if (profile.phone) store.hset(profileKey, "phone", profile.phone);
}

/**
 * Check if user has completed onboarding
 * @param {string} uid - User ID
 * @returns {boolean} - true if user has profile data
 */
async function hasCompletedOnboarding(uid) {
  const profile = await getUserProfile(uid);
  return profile && profile.name && profile.email;
}

/**
 * Check if user has Google Calendar linked
 * @param {string} uid - User ID
 * @returns {boolean} - true if user has refresh token
 */
async function hasGoogleCalendarLinked(uid) {
  const gcalKey = `user:${uid}:gcal`;
  const refreshToken = store.hget(gcalKey, "refresh_token");
  return !!refreshToken;
}

module.exports = {
  addUserIfNew,
  getSettings,
  setSettings,
  getUserProfile,
  saveUserProfile,
  hasCompletedOnboarding,
  hasGoogleCalendarLinked,
};
