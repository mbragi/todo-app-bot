/**
 * Simple structured logger wrapper with colors
 * Uses meta field for structured data instead of embedding JSON in messages
 */
class Logger {
  constructor() {
    this.colors = {
      reset: "\x1b[0m",
      bright: "\x1b[1m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
      gray: "\x1b[90m",
    };
  }

  /**
   * Get color for log level
   * @param {string} level - Log level
   * @returns {string} Color code
   */
  getColor(level) {
    switch (level) {
      case "error":
        return this.colors.red;
      case "warn":
        return this.colors.yellow;
      case "info":
        return this.colors.green;
      case "debug":
        return this.colors.blue;
      default:
        return this.colors.reset;
    }
  }

  /**
   * Format log entry with colors
   * @param {Object} logEntry - Log entry object
   * @returns {string} Formatted log string
   */
  formatLog(logEntry) {
    const color = this.getColor(logEntry.level);
    const timestamp = this.colors.gray + logEntry.timestamp + this.colors.reset;
    const level =
      color +
      this.colors.bright +
      logEntry.level.toUpperCase() +
      this.colors.reset;
    const message = this.colors.reset + logEntry.message;

    let metaStr = "";
    if (Object.keys(logEntry).length > 4) {
      // More than level, message, timestamp
      const meta = { ...logEntry };
      delete meta.level;
      delete meta.message;
      delete meta.timestamp;
      metaStr =
        this.colors.cyan + " " + JSON.stringify(meta) + this.colors.reset;
    }

    return `${timestamp} ${level} ${message}${metaStr}`;
  }

  /**
   * Log info message with optional meta data
   * @param {string} message - Log message
   * @param {Object} meta - Optional structured data
   */
  info(message, meta = {}) {
    const logEntry = {
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.log(this.formatLog(logEntry));
  }

  /**
   * Log error message with optional meta data
   * @param {string} message - Error message
   * @param {Error} error - Optional error object
   * @param {Object} meta - Optional structured data
   */
  error(message, error = null, meta = {}) {
    const logEntry = {
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };

    if (error) {
      logEntry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    console.error(this.formatLog(logEntry));
  }

  /**
   * Log warning message with optional meta data
   * @param {string} message - Warning message
   * @param {Object} meta - Optional structured data
   */
  warn(message, meta = {}) {
    const logEntry = {
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.warn(this.formatLog(logEntry));
  }

  /**
   * Log debug message with optional meta data
   * @param {string} message - Debug message
   * @param {Object} meta - Optional structured data
   */
  debug(message, meta = {}) {
    const logEntry = {
      level: "debug",
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    console.debug(this.formatLog(logEntry));
  }
}

module.exports = new Logger();
