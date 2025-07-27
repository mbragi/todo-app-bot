const express = require("express");
const config = require("./lib/config");
const logger = require("./lib/logger");

/**
 * Create and configure Express server
 * @returns {express.Application} Configured Express app
 */
function createServer() {
  const app = express();

  // Middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      method: req.method,
      path: req.path,
      userAgent: req.get("User-Agent"),
      ip: req.ip,
    });
    next();
  });

  // Routes
  app.use("/health", require("./routes/health"));
  app.use("/webhook", require("./routes/webhook"));
  app.use("/send", require("./routes/send"));

  // 404 handler
  app.use((req, res) => {
    logger.warn("Route not found", { path: req.path, method: req.method });
    res.status(404).json({ error: "Not Found" });
  });

  // Error handler
  app.use((error, req, res, next) => {
    logger.error("Unhandled error", error, {
      path: req.path,
      method: req.method,
    });
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;
}

module.exports = createServer;
