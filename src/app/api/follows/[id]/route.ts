export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { follows } from "@/db/schema";
import { requireNotBlockedBetween, requireUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, eq } from "drizzle-orm";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await ctx.params;
  const user = await requireUser();
  if (targetUserId === user.id) return Response.json({ error: "Cannot follow yourself" }, { status: 400 });

  try {
    await requireNotBlockedBetween(user.id, targetUserId);
  } catch {
    return Response.json({ error: "Blocked" }, { status: 403 });
  }

  try {
    await rateLimitOrThrow({ key: `follow:${user.id}`, limit: 20, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: follows.id })
    .from(follows)
    .where(and(eq(follows.followerId, user.id), eq(follows.followedId, targetUserId)))
    .limit(1);

  if (existing) {
    await db.delete(follows).where(eq(follows.id, existing.id));
    return Response.json({ following: false });
  }

  await db.insert(follows).values({ followerId: user.id, followedId: targetUserId });

  void createNotification({
    userId: targetUserId,
    type: "followed_you",
    title: "New follower",
    body: `${user.displayName} followed you.`,
    href: `/community`,
    push: true,
  });

  return Response.json({ following: true });
}

