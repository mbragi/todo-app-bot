const store = require("../store");

const USERS_SET = "users:set";

async function addUserIfNew(uid) {
  if (!store.sismember(USERS_SET, uid)) {
    store.sadd(USERS_SET, uid);
    // defaults
    const key = `user:${uid}:settings`;
    if (!store.hget(key, "tz"))
      store.hset(key, "tz", process.env.TZ || "Africa/Lagos");
    if (!store.hget(key, "calendarId"))
      store.hset(
        key,
        "calendarId",
        process.env.GOOGLE_CALENDAR_ID || "primary"
      );
  }
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

module.exports = { addUserIfNew, getSettings, setSettings };
