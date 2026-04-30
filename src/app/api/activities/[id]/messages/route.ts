export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities, activityMessages, activityParticipants, blocks, users } from "@/db/schema";
import { getCurrentUser, requireNotBlockedBetween, requireUser } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, desc, eq, notInArray, or } from "drizzle-orm";

function cleanBody(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || v.length > 1200) return null;
  return v;
}

async function canPost(userId: string, activityId: string): Promise<{ ok: boolean; creatorId: string | null }> {
  const db = getDb();
  const [row] = await db.select({ creatorId: activities.creatorId }).from(activities).where(eq(activities.id, activityId));
  if (!row) return { ok: false, creatorId: null };
  if (row.creatorId === userId) return { ok: true, creatorId: row.creatorId };

  const [p] = await db
    .select({ id: activityParticipants.id })
    .from(activityParticipants)
    .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, userId)))
    .limit(1);
  return { ok: !!p, creatorId: row.creatorId };
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await ctx.params;
  const db = getDb();

  const me = await getCurrentUser();
  let blockedIds: string[] = [];
  if (me) {
    const rows = await db
      .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
      .from(blocks)
      .where(or(eq(blocks.blockerId, me.id), eq(blocks.blockedId, me.id)));
    blockedIds = rows.map((r) => (r.blockerId === me.id ? r.blockedId : r.blockerId));
  }

  const rows = await db
    .select({
      id: activityMessages.id,
      activityId: activityMessages.activityId,
      body: activityMessages.body,
      createdAt: activityMessages.createdAt,
      author: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
      authorUserId: activityMessages.authorUserId,
    })
    .from(activityMessages)
    .innerJoin(users, eq(activityMessages.authorUserId, users.id))
    .where(
      blockedIds.length > 0
        ? and(eq(activityMessages.activityId, activityId), notInArray(activityMessages.authorUserId, blockedIds))
        : eq(activityMessages.activityId, activityId),
    )
    .orderBy(desc(activityMessages.createdAt))
    .limit(60);

  return Response.json(rows);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: activityId } = await ctx.params;
  const user = await requireUser();

  let bodyJson: { body?: unknown };
  try {
    bodyJson = (await req.json()) as { body?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const msg = cleanBody(bodyJson.body);
  if (!msg) return Response.json({ error: "Message required" }, { status: 400 });

  const allowed = await canPost(user.id, activityId);
  if (!allowed.ok) return Response.json({ error: "Not allowed" }, { status: 403 });
  if (allowed.creatorId) await requireNotBlockedBetween(user.id, allowed.creatorId);

  await rateLimitOrThrow({ key: `msg:${user.id}`, limit: 20, windowMs: 60_000 });

  const db = getDb();
  const [created] = await db
    .insert(activityMessages)
    .values({ activityId, authorUserId: user.id, body: msg })
    .returning();

  if (allowed.creatorId && allowed.creatorId !== user.id) {
    void createNotification({
      userId: allowed.creatorId,
      type: "message_posted",
      title: "New message",
      body: `${user.displayName}: ${msg.length > 80 ? `${msg.slice(0, 77)}…` : msg}`,
      href: `/map?activity=${encodeURIComponent(activityId)}`,
      push: true,
    });
  }

  return Response.json({
    id: created.id,
    activityId: created.activityId,
    body: created.body,
    createdAt: created.createdAt,
    authorUserId: user.id,
    author: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl },
  });
}

