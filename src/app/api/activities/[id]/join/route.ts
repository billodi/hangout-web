export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

export async function POST(_req: Request, ctx: RouteContext<"/api/activities/[id]/join">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [existingMembership] = await db
    .select()
    .from(activityParticipants)
    .where(and(eq(activityParticipants.activityId, id), eq(activityParticipants.userId, currentUser.id)));
  if (existingMembership) {
    const [already] = await db.select().from(activities).where(eq(activities.id, id));
    if (!already) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ...already, joined: true });
  }

  const [updated] = await db
    .update(activities)
    .set({ going: sql`${activities.going} + 1` })
    .where(and(eq(activities.id, id), or(isNull(activities.limit), lt(activities.going, activities.limit))))
    .returning();

  if (updated) {
    await db.insert(activityParticipants).values({
      activityId: id,
      userId: currentUser.id,
    });
    return Response.json({ ...updated, joined: true });
  }

  const [existing] = await db.select().from(activities).where(eq(activities.id, id));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.limit !== null && existing.going >= existing.limit) return Response.json({ error: "Full" }, { status: 409 });
  return Response.json({ error: "Could not join" }, { status: 500 });
}
