const createServer = require("./server");
const config = require("./lib/config");
const logger = require("./lib/logger");

/**
 * Start the WhatsApp Productivity Assistant server
 */
async function startServer() {
  try {
    const app = createServer();
    const port = config.server.port;

    const server = app.listen(port, () => {
      logger.info("WhatsApp Productivity Assistant started", {
        port,
        nodeEnv: config.server.nodeEnv,
        messagingProvider: config.messagingProvider,
        timezone: config.timezone,
      });
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`Received ${signal}, shutting down gracefully`);

      server.close(async () => {
        logger.info("HTTP server closed");
          logger.info("Graceful shutdown completed");
          process.exit(0);
      });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server", error);
    process.exit(1);
  }
}

// Start the application
startServer();
