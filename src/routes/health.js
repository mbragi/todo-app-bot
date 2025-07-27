const express = require("express");
const router = express.Router();

/**
 * Health check endpoint
 * Returns service status for monitoring and Docker healthchecks
 */
router.get("/", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "whatsapp-productivity-assistant",
    version: "1.0.0",
  });
});

module.exports = router;
