type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  error?: string;
  stack?: string;
  [key: string]: unknown;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function log(level: LogLevel, module: string, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    module,
    message,
    ...meta,
  };

  if (isProduction()) {
    console[level](JSON.stringify(entry));
  } else {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${module}]`;
    const rest = meta?.error ? `${message} ${meta.error}` : message;
    if (level === "error") {
      console.error(prefix, rest, meta?.stack ? `\n${meta.stack}` : "");
    } else {
      console[level](prefix, rest);
    }
  }
}

export const logger = {
  debug: (module: string, message: string, meta?: Record<string, unknown>) => log("debug", module, message, meta),
  info: (module: string, message: string, meta?: Record<string, unknown>) => log("info", module, message, meta),
  warn: (module: string, message: string, meta?: Record<string, unknown>) => log("warn", module, message, meta),
  error: (module: string, message: string, error?: unknown, meta?: Record<string, unknown>) => {
    const err = error instanceof Error ? error : undefined;
    log("error", module, message, {
      ...meta,
      error: err?.message ?? String(error ?? ""),
      stack: isProduction() ? undefined : err?.stack,
    });
  },
};
