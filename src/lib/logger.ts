/**
 * Simple Logger Utility
 *
 * Provides structured logging with JSON output for production
 * and readable output for development.
 *
 * @see docs/architecture.md
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

/**
 * Format log entry based on environment.
 */
function formatLog(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...context,
  };

  // In production, output as JSON for log aggregation
  // In development, use console methods for readability
  if (process.env.NODE_ENV === "production") {
    console.log(JSON.stringify(entry));
  } else {
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[90m", // gray
      info: "\x1b[36m", // cyan
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
    };
    const reset = "\x1b[0m";
    const color = levelColors[level];

    if (context && Object.keys(context).length > 0) {
      console[level](`${color}[${level.toUpperCase()}]${reset} ${message}`, context);
    } else {
      console[level](`${color}[${level.toUpperCase()}]${reset} ${message}`);
    }
  }
}

/**
 * Logger instance with level-specific methods.
 */
export const logger = {
  debug: (message: string, context?: LogContext) => formatLog("debug", message, context),
  info: (message: string, context?: LogContext) => formatLog("info", message, context),
  warn: (message: string, context?: LogContext) => formatLog("warn", message, context),
  error: (message: string, context?: LogContext) => formatLog("error", message, context),
};
