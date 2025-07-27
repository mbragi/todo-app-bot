// Storage factory: cache-manager based (supports Redis, Memcache, Memory)
const config = require("../lib/config");

let impl;
if (config.store.backend === "memory" || config.store.backend === "cache") {
  impl = require("./cache");
} else if (config.store.backend === "redis") {
  impl = require("./cache"); // cache store can handle Redis via cache-manager
} else {
  throw new Error(`Unsupported STORE_BACKEND=${config.store.backend}`);
}

module.exports = impl;
