import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const { combine, timestamp, printf, errors, colorize } = format;

// Custom timestamp (12-hour)
const customTimestamp = timestamp({
  format: () =>
    new Date().toLocaleString("en-IN", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: true,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
});

const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] - ${stack || message}`;
});

const fileFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]  - ${stack || message}`;
});

const productionLogger = () => {
  const dailyError = new transports.DailyRotateFile({
    filename: "logs/error-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    level: "error",
    zippedArchive: true,
    maxSize: "10m",
    maxFiles: "14d", // keep 14 days of logs
  });

  const dailyCombined = new transports.DailyRotateFile({
    filename: "logs/combined-%DATE%.log",
    datePattern: "YYYY-MM-DD",
    level: process.env.LOG_LEVEL || "info", // logs info, warn, debug
    zippedArchive: true,
    maxSize: "10m",
    maxFiles: "14d",
  });

  return createLogger({
    level: process.env.LOG_LEVEL || "info",
    format: combine(customTimestamp, errors({ stack: true })),
    defaultMeta: { service: "openphone-service" },
    transports: [
      dailyCombined, // all logs
      dailyError, // error-only logs
      new transports.Console({
        format: combine(colorize(), customTimestamp, consoleFormat),
        level: "info",
        handleExceptions: true,
        handleRejections: true,
      }),
    ],
    exceptionHandlers: [
      new transports.DailyRotateFile({
        filename: "logs/exceptions-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxSize: "10m",
        maxFiles: "14d",
        zippedArchive: true,
      }),
    ],
    rejectionHandlers: [
      new transports.DailyRotateFile({
        filename: "logs/rejections-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        maxSize: "10m",
        maxFiles: "14d",
        zippedArchive: true,
      }),
    ],
  });
};

// Select logger based on environment
const logger =
  process.env.NODE_ENV === "production"
    ? productionLogger()
    : createLogger({
        level: "info",
        format: combine(customTimestamp, errors({ stack: true })),
        transports: [
          new transports.Console({
            format: combine(colorize(), customTimestamp, consoleFormat),
            handleExceptions: true,
            handleRejections: true,
          }),
          new transports.File({
            filename: "logs/developmentHistoricRecords.log",
            format: fileFormat,
            level: "info",
            maxsize: 5 * 1024 * 1024, // 5MB
            handleExceptions: true,
            handleRejections: true,
          }),
        ],
      });

export { logger };
