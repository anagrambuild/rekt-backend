// Production-Ready Logging System
// Structured logging with levels, rotation, and monitoring support

const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");

// Create logs directory if it doesn't exist
const fs = require("fs");
const logsDir = path.join(__dirname, "../logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: "YYYY-MM-DD HH:mm:ss.SSS",
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: "HH:mm:ss",
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      metaStr = " " + JSON.stringify(meta);
    }
    return `${timestamp} [${level}] ${message}${metaStr}`;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: {
    service: "rekt-backend",
    version: process.env.npm_package_version || "1.0.0",
  },
  transports: [
    // Error log file - only errors
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "14d",
      zippedArchive: true,
    }),

    // Combined log file - all levels
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "7d",
      zippedArchive: true,
    }),

    // Console output for development
    new winston.transports.Console({
      format: process.env.NODE_ENV === "production" ? logFormat : consoleFormat,
      level: process.env.NODE_ENV === "production" ? "info" : "debug",
    }),
  ],

  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],

  rejectionHandlers: [
    new DailyRotateFile({
      filename: path.join(logsDir, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
  ],
});

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get("User-Agent"),
    ip: req.ip || req.connection.remoteAddress,
    contentLength: res.get("Content-Length"),
  };

  if (res.statusCode >= 400) {
    logger.warn("HTTP Request", logData);
  } else {
    logger.info("HTTP Request", logData);
  }
};

// Add trade logging helper
logger.logTrade = (action, data) => {
  logger.info(`Trade ${action}`, {
    action,
    walletAddress: data.walletAddress,
    market: data.marketSymbol || data.market,
    leverage: data.leverage,
    amount: data.tradeAmount || data.amount,
    direction: data.direction,
    timestamp: new Date().toISOString(),
  });
};

// Add error logging helper with context
logger.logError = (error, context = {}) => {
  logger.error("Application Error", {
    message: error.message,
    stack: error.stack,
    code: error.code,
    ...context,
    timestamp: new Date().toISOString(),
  });
};

// Add WebSocket logging helper
logger.logWebSocket = (event, data = {}) => {
  logger.debug("WebSocket Event", {
    event,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

// Add Drift SDK logging helper
logger.logDrift = (operation, data = {}) => {
  logger.debug("Drift SDK Operation", {
    operation,
    ...data,
    timestamp: new Date().toISOString(),
  });
};

module.exports = logger;
