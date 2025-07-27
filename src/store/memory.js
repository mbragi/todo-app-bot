// Simple in-process store for dev. Data is lost on restart.
const sets = new Map(); // key -> Set
const hashes = new Map(); // key -> Map
const strings = new Map(); // key -> string

function _getSet(key) {
  if (!sets.has(key)) sets.set(key, new Set());
  return sets.get(key);
}
function _getHash(key) {
  if (!hashes.has(key)) hashes.set(key, new Map());
  return hashes.get(key);
}

module.exports = {
  // SET ops (for users:set, allowlist, etc.)
  sadd(key, member) {
    _getSet(key).add(member);
  },
  smembers(key) {
    return Array.from(_getSet(key).values());
  },
  sismember(key, member) {
    return _getSet(key).has(member);
  },

  // HASH ops (for per-user settings and tokens)
  hget(key, field) {
    return _getHash(key).get(field) ?? null;
  },
  hset(key, field, value) {
    _getHash(key).set(field, value);
  },
  hgetall(key) {
    return Object.fromEntries(_getHash(key).entries());
  },

  // STRING ops (flags/caches)
  get(key) {
    return strings.get(key) ?? null;
  },
  set(key, value) {
    strings.set(key, value);
  },
};
