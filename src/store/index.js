// Storage factory: memory now, Redis later (no caller changes needed)
const config = require("../lib/config");

let impl;
if (config.store.backend === "memory") {
  impl = require("./memory");
} else if (config.store.backend === "redis") {
  impl = require("./redis"); // implement later with same API
} else {
  throw new Error(`Unsupported STORE_BACKEND=${config.store.backend}`);
}

module.exports = impl;
