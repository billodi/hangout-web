export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq, inArray, isNull } from "drizzle-orm";

type Payload = { ids?: unknown; all?: unknown };

export async function POST(req: Request) {
  try {
    const user = await requireUser();

    let body: Payload;
    try {
      body = (await req.json()) as Payload;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const db = getDb();
    const nowIso = new Date().toISOString();

    const all = body.all === true;
    const ids = Array.isArray(body.ids) ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 10).slice(0, 50) : [];

    if (!all && ids.length === 0) return Response.json({ error: "No ids" }, { status: 400 });

    if (all) {
      await db
        .update(notifications)
        .set({ readAt: nowIso })
        .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
      return Response.json({ ok: true });
    }

    await db
      .update(notifications)
      .set({ readAt: nowIso })
      .where(and(eq(notifications.userId, user.id), inArray(notifications.id, ids)));

    return Response.json({ ok: true });
  } catch (error) {
    // Degrade gracefully if notifications table is not available.
    console.error("POST /api/notifications/mark-read failed", error);
    return Response.json({ ok: true, degraded: true });
  }
}
