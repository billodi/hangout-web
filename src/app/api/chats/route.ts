export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { and, desc, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, chatMessages, chatThreads, users } from "@/db/schema";
import { requireNotBlockedBetween, requireUser } from "@/lib/auth";

type CreatePayload = { userId?: unknown };

function toPair(a: string, b: string) {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

export async function GET() {
  try {
    const me = await requireUser();
    const db = getDb();

    const threads = await db
      .select()
      .from(chatThreads)
      .where(or(eq(chatThreads.userLowId, me.id), eq(chatThreads.userHighId, me.id)))
      .orderBy(desc(chatThreads.updatedAt))
      .limit(60);

    if (threads.length === 0) return Response.json({ items: [] });

    const items = await Promise.all(
      threads.map(async (thread) => {
        const otherUserId = thread.userLowId === me.id ? thread.userHighId : thread.userLowId;

        const [otherUser, lastMessage, unreadRow] = await Promise.all([
          db
            .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
            .from(users)
            .where(eq(users.id, otherUserId))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          db
            .select({ id: chatMessages.id, body: chatMessages.body, authorUserId: chatMessages.authorUserId, createdAt: chatMessages.createdAt })
            .from(chatMessages)
            .where(eq(chatMessages.threadId, thread.id))
            .orderBy(desc(chatMessages.createdAt))
            .limit(1)
            .then((rows) => rows[0] ?? null),
          db
            .select({ id: chatMessages.id })
            .from(chatMessages)
            .where(and(eq(chatMessages.threadId, thread.id), isNull(chatMessages.readAt), eq(chatMessages.authorUserId, otherUserId)))
            .then((rows) => rows.length),
        ]);

        return {
          id: thread.id,
          otherUser,
          unreadCount: unreadRow,
          updatedAt: thread.updatedAt,
          lastMessage,
        };
      }),
    );

    return Response.json({ items });
  } catch (error) {
    console.error("GET /api/chats failed", error);
    return Response.json({ error: "Could not load chats" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireUser();

    let body: CreatePayload;
    try {
      body = (await req.json()) as CreatePayload;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const otherId = typeof body.userId === "string" ? body.userId : "";
    if (!otherId || otherId === me.id) return Response.json({ error: "Invalid user" }, { status: 400 });

    await requireNotBlockedBetween(me.id, otherId);

    const db = getDb();
    const pair = toPair(me.id, otherId);

    const [existing] = await db
      .select({ id: chatThreads.id })
      .from(chatThreads)
      .where(and(eq(chatThreads.userLowId, pair.low), eq(chatThreads.userHighId, pair.high)))
      .limit(1);

    if (existing) return Response.json({ threadId: existing.id });

    const [created] = await db
      .insert(chatThreads)
      .values({ userLowId: pair.low, userHighId: pair.high })
      .returning({ id: chatThreads.id });

    return Response.json({ threadId: created.id });
  } catch (error) {
    console.error("POST /api/chats failed", error);
    return Response.json({ error: error instanceof Error ? error.message : "Could not create chat" }, { status: 400 });
  }
}
