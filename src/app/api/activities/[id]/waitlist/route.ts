export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activityWaitlist, activities } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, eq } from "drizzle-orm";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await ctx.params;
  const user = await requireUser();
  try {
    await rateLimitOrThrow({ key: `waitlist:${user.id}`, limit: 12, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const db = getDb();
  const [activity] = await db.select().from(activities).where(eq(activities.id, activityId));
  if (!activity) return Response.json({ error: "Not found" }, { status: 404 });

  const [member] = await db
    .select({ id: activityParticipants.id })
    .from(activityParticipants)
    .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, user.id)))
    .limit(1);
  if (member) return Response.json({ error: "Already joined" }, { status: 409 });

  const [existing] = await db
    .select({ id: activityWaitlist.id })
    .from(activityWaitlist)
    .where(and(eq(activityWaitlist.activityId, activityId), eq(activityWaitlist.userId, user.id)))
    .limit(1);

  if (existing) {
    await db.delete(activityWaitlist).where(eq(activityWaitlist.id, existing.id));
    return Response.json({ waitlisted: false });
  }

  await db.insert(activityWaitlist).values({ activityId, userId: user.id });
  return Response.json({ waitlisted: true });
}

