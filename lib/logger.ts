type ServerLogLevel = "info" | "warn" | "error";

type ServerLogPayload = {
  level: ServerLogLevel;
  event: string;
  timestamp: string;
} & Record<string, unknown>;

function writeStructuredLog(level: ServerLogLevel, event: string, details?: Record<string, unknown>) {
  const payload: ServerLogPayload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(details ?? {}),
  };

  process.stderr.write(`${JSON.stringify(payload)}\n`);
}

export function logServerWarning(event: string, details?: Record<string, unknown>) {
  writeStructuredLog("warn", event, details);
}
