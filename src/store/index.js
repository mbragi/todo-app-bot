// Storage factory: memory now, Redis later (no caller changes needed)
const backend = (process.env.STORE_BACKEND || "memory").toLowerCase();

let impl;
if (backend === "memory") {
  impl = require("./memory");
} else if (backend === "redis") {
  impl = require("./redis"); // implement later with same API
} else {
  throw new Error(`Unsupported STORE_BACKEND=${backend}`);
}

module.exports = impl;
