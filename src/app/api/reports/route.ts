export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { reportTargetType, reports } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { getClientIp, requestId } from "@/lib/requestMeta";
import { rateLimitOrThrow } from "@/lib/rateLimit";

type Payload = {
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
};

function cleanReason(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 3 || s.length > 600) return null;
  return s;
}

export async function POST(req: Request) {
  const rid = requestId();
  const ip = getClientIp(req);
  const startedAt = Date.now();
  const user = await requireUser();
  try {
    await rateLimitOrThrow({ key: `report:${user.id}`, limit: 10, windowMs: 60_000 });
    await rateLimitOrThrow({ key: `report:ip:${ip}`, limit: 20, windowMs: 60_000 });
  } catch {
    logApiEvent({ level: "warn", route: "/api/reports", requestId: rid, message: "rate_limited", meta: { userId: user.id, ip } });
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    logApiEvent({ level: "warn", route: "/api/reports", requestId: rid, message: "invalid_json", meta: { userId: user.id, ip } });
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetType = typeof body.targetType === "string" ? body.targetType : null;
  const targetId = typeof body.targetId === "string" ? body.targetId : null;
  const reason = cleanReason(body.reason);

  if (!targetType || !targetId || !reason) {
    logApiEvent({ level: "warn", route: "/api/reports", requestId: rid, message: "invalid_payload", meta: { userId: user.id, ip } });
    return Response.json({ error: "Invalid report" }, { status: 400 });
  }
  const allowedTargets = reportTargetType.enumValues as readonly string[];
  if (!allowedTargets.includes(targetType)) {
    logApiEvent({ level: "warn", route: "/api/reports", requestId: rid, message: "invalid_target_type", meta: { userId: user.id, ip } });
    return Response.json({ error: "Invalid target type" }, { status: 400 });
  }

  const db = getDb();
  const [created] = await db
    .insert(reports)
    .values({
      reporterUserId: user.id,
      targetType: targetType as (typeof reportTargetType.enumValues)[number],
      targetId,
      reason,
    })
    .returning();

  logApiEvent({
    route: "/api/reports",
    requestId: rid,
    message: "report_created",
    durationMs: Date.now() - startedAt,
    meta: { userId: user.id, ip, targetType, targetId, reportId: created.id },
  });

  return Response.json({ ok: true, report: created });
}
