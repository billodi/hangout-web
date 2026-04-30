export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activityWaitlist, activities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, asc, eq, sql } from "drizzle-orm";

export async function POST(_req: Request, ctx: RouteContext<"/api/activities/[id]/leave">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });
  try {
    await rateLimitOrThrow({ key: `leave:${currentUser.id}`, limit: 12, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

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

  const [activity] = await db.select().from(activities).where(eq(activities.id, id));
  if (!activity) return Response.json({ error: "Not found" }, { status: 404 });
  if (activity.creatorId === currentUser.id) {
    return Response.json({ error: "Creator cannot leave their own activity" }, { status: 409 });
  }

  await db.delete(activityParticipants).where(eq(activityParticipants.id, membership.id));

  const [updated] = await db
    .update(activities)
    .set({ going: sql`GREATEST(${activities.going} - 1, 0)` })
    .where(eq(activities.id, id))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  if (activity.creatorId && activity.creatorId !== currentUser.id) {
    void createNotification({
      userId: activity.creatorId,
      type: "activity_left",
      title: "Someone left",
      body: `${currentUser.displayName} left “${activity.title}”.`,
      href: `/map?activity=${encodeURIComponent(id)}`,
      push: true,
    });
  }

  if (updated.limit !== null && updated.going < updated.limit) {
    const [next] = await db
      .select({ userId: activityWaitlist.userId })
      .from(activityWaitlist)
      .where(eq(activityWaitlist.activityId, id))
      .orderBy(asc(activityWaitlist.createdAt))
      .limit(1);
    if (next?.userId) {
      void createNotification({
        userId: next.userId,
        type: "activity_updated",
        title: "Seat opened up",
        body: `A spot opened in “${activity.title}”.`,
        href: `/map?activity=${encodeURIComponent(id)}`,
        push: true,
      });
    }
  }
  return Response.json({ ...updated, joined: false });
}
