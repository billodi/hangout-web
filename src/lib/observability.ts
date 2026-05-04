import { incrementMetric, observeMetric } from "@/lib/metrics";

type LogLevel = "info" | "warn" | "error";

type ApiLog = {
  level?: LogLevel;
  route: string;
  requestId?: string;
  message: string;
  durationMs?: number;
  meta?: Record<string, unknown>;
};

export function logApiEvent(evt: ApiLog) {
  const payload = {
    ts: new Date().toISOString(),
    level: evt.level ?? "info",
    route: evt.route,
    requestId: evt.requestId ?? null,
    message: evt.message,
    durationMs: evt.durationMs ?? null,
    meta: evt.meta ?? null,
  };
  const line = JSON.stringify(payload);
  incrementMetric(`api.event.${payload.route}.${payload.level}`);
  if (typeof payload.durationMs === "number") {
    observeMetric(`api.duration.${payload.route}`, payload.durationMs);
  }
  if (payload.level === "error") {
    console.error(line);
    return;
  }
  if (payload.level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
