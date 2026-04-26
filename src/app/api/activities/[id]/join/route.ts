export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

export async function POST(_req: Request, ctx: RouteContext<"/api/activities/[id]/join">) {
  const { id } = await ctx.params;
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [updated] = await db
    .update(activities)
    .set({ going: sql`${activities.going} + 1` })
    .where(and(eq(activities.id, id), or(isNull(activities.limit), lt(activities.going, activities.limit))))
    .returning();

  if (updated) return Response.json(updated);

  const [existing] = await db.select().from(activities).where(eq(activities.id, id));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.limit !== null && existing.going >= existing.limit) return Response.json({ error: "Full" }, { status: 409 });
  return Response.json({ error: "Could not join" }, { status: 500 });
}
