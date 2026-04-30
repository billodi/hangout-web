export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityCheckins, activityParticipants } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, eq } from "drizzle-orm";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await ctx.params;
  const user = await requireUser();
  try {
    await rateLimitOrThrow({ key: `checkin:${user.id}`, limit: 20, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const db = getDb();
  const [member] = await db
    .select({ id: activityParticipants.id })
    .from(activityParticipants)
    .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, user.id)))
    .limit(1);
  if (!member) return Response.json({ error: "Join required" }, { status: 403 });

  const [existing] = await db
    .select({ id: activityCheckins.id })
    .from(activityCheckins)
    .where(and(eq(activityCheckins.activityId, activityId), eq(activityCheckins.userId, user.id)))
    .limit(1);

  if (existing) {
    await db.delete(activityCheckins).where(eq(activityCheckins.id, existing.id));
    return Response.json({ checkedIn: false });
  }

  await db.insert(activityCheckins).values({ activityId, userId: user.id });
  return Response.json({ checkedIn: true });
}

