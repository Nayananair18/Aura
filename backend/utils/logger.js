const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors, json } = format;
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

// Custom dev format
const devFormat = printf(({ level, message, timestamp, stack }) => {
  return stack
    ? `[${timestamp}] ${level}: ${message}\n${stack}`
    : `[${timestamp}] ${level}: ${message}`;
});

const logger = createLogger({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    isProd ? json() : combine(colorize(), devFormat)
  ),
  transports: isProd
    ? [
        new transports.Console(),
        new transports.File({
          filename: path.join(__dirname, '../../logs/error.log'),
          level: 'error',
          maxsize: 5 * 1024 * 1024, // 5 MB
          maxFiles: 5,
        }),
        new transports.File({
          filename: path.join(__dirname, '../../logs/combined.log'),
          maxsize: 10 * 1024 * 1024, // 10 MB
          maxFiles: 10,
        }),
      ]
    : [new transports.Console()],
});

/**
 * Morgan-compatible write stream for HTTP request logging
 */
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
