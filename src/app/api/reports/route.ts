export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { reportTargetType, reports } from "@/db/schema";
import { requireUser } from "@/lib/auth";
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
  const user = await requireUser();
  try {
    await rateLimitOrThrow({ key: `report:${user.id}`, limit: 10, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetType = typeof body.targetType === "string" ? body.targetType : null;
  const targetId = typeof body.targetId === "string" ? body.targetId : null;
  const reason = cleanReason(body.reason);

  if (!targetType || !targetId || !reason) return Response.json({ error: "Invalid report" }, { status: 400 });
  if (!reportTargetType.enumValues.includes(targetType as any)) return Response.json({ error: "Invalid target type" }, { status: 400 });

  const db = getDb();
  const [created] = await db
    .insert(reports)
    .values({ reporterUserId: user.id, targetType: targetType as any, targetId, reason })
    .returning();

  return Response.json({ ok: true, report: created });
}

