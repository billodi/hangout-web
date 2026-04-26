export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(_req: Request, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [deleted] = await db.delete(activities).where(eq(activities.id, id)).returning();
  if (!deleted) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
