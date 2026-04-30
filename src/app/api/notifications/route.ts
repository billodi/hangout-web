export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(5, Number.parseInt(url.searchParams.get("limit") ?? "30", 10) || 30));
    const unreadOnly = url.searchParams.get("unread") === "1";

    const db = getDb();

    const items = await db
      .select()
      .from(notifications)
      .where(unreadOnly ? and(eq(notifications.userId, user.id), isNull(notifications.readAt)) : eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));

    return Response.json({ items, unreadCount: Number(countRow?.count ?? 0) });
  } catch (error) {
    // Keep navigation stable even if notification storage is unavailable on a deployment.
    console.error("GET /api/notifications failed", error);
    return Response.json({ items: [], unreadCount: 0, degraded: true });
  }
}
