export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

export async function POST(_req: Request, ctx: RouteContext<"/api/activities/[id]/leave">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [membership] = await db
    .select()
    .from(activityParticipants)
    .where(and(eq(activityParticipants.activityId, id), eq(activityParticipants.userId, currentUser.id)));
  if (!membership) {
    const [existing] = await db.select().from(activities).where(eq(activities.id, id));
    if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ...existing, joined: false });
  }

  await db.delete(activityParticipants).where(eq(activityParticipants.id, membership.id));

  const [updated] = await db
    .update(activities)
    .set({ going: sql`GREATEST(${activities.going} - 1, 0)` })
    .where(eq(activities.id, id))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ...updated, joined: false });
}
