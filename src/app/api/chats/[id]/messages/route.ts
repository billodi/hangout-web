export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads, users } from "@/db/schema";
import { requireNotBlockedBetween, requireUser } from "@/lib/auth";
import { logApiEvent } from "@/lib/observability";
import { getClientIp, requestId } from "@/lib/requestMeta";
import { rateLimitOrThrow } from "@/lib/rateLimit";

type Params = { params: Promise<{ id: string }> };
type CreatePayload = { body?: unknown };

async function loadThreadForUser(threadId: string, userId: string) {
  const db = getDb();
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, threadId), or(eq(chatThreads.userLowId, userId), eq(chatThreads.userHighId, userId))))
    .limit(1);
  return thread ?? null;
}

export async function GET(_: Request, props: Params) {
  try {
    const me = await requireUser();
    const { id } = await props.params;
    const thread = await loadThreadForUser(id, me.id);
    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    const db = getDb();
    const rows = await db
      .select({
        id: chatMessages.id,
        threadId: chatMessages.threadId,
        body: chatMessages.body,
        createdAt: chatMessages.createdAt,
        readAt: chatMessages.readAt,
        authorUserId: chatMessages.authorUserId,
        author: { id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl },
      })
      .from(chatMessages)
      .innerJoin(users, eq(chatMessages.authorUserId, users.id))
      .where(eq(chatMessages.threadId, id))
      .orderBy(desc(chatMessages.createdAt))
      .limit(100);

    return Response.json(rows);
  } catch (error) {
    console.error("GET /api/chats/[id]/messages failed", error);
    return Response.json({ error: "Could not load messages" }, { status: 500 });
  }
}

export async function POST(req: Request, props: Params) {
  const rid = requestId();
  const ip = getClientIp(req);
  const startedAt = Date.now();
  try {
    const me = await requireUser();
    const { id } = await props.params;
    const thread = await loadThreadForUser(id, me.id);
    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    const otherId = thread.userLowId === me.id ? thread.userHighId : thread.userLowId;
    await requireNotBlockedBetween(me.id, otherId);

    let body: CreatePayload;
    try {
      body = (await req.json()) as CreatePayload;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const text = typeof body.body === "string" ? body.body.trim() : "";
    if (!text) return Response.json({ error: "Message required" }, { status: 400 });
    if (text.length > 1500) return Response.json({ error: "Message too long" }, { status: 400 });

    try {
      await rateLimitOrThrow({ key: `chat:msg:user:${me.id}`, limit: 20, windowMs: 60_000 });
      await rateLimitOrThrow({ key: `chat:msg:ip:${ip}`, limit: 50, windowMs: 60_000 });
    } catch {
      logApiEvent({ level: "warn", route: "/api/chats/[id]/messages", requestId: rid, message: "rate_limited", meta: { userId: me.id, ip, threadId: id } });
      return Response.json({ error: "Rate limited" }, { status: 429 });
    }

    const db = getDb();
    const nowIso = new Date().toISOString();

    const [created] = await db
      .insert(chatMessages)
      .values({ threadId: id, authorUserId: me.id, body: text })
      .returning({ id: chatMessages.id, threadId: chatMessages.threadId, body: chatMessages.body, createdAt: chatMessages.createdAt, readAt: chatMessages.readAt, authorUserId: chatMessages.authorUserId });

    await db.update(chatThreads).set({ updatedAt: nowIso }).where(eq(chatThreads.id, id));

    const [author] = await db
      .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
      .from(users)
      .where(eq(users.id, me.id))
      .limit(1);

    logApiEvent({
      route: "/api/chats/[id]/messages",
      requestId: rid,
      message: "chat_message_created",
      durationMs: Date.now() - startedAt,
      meta: { userId: me.id, ip, threadId: id, messageId: created.id },
    });

    return Response.json({ ...created, author });
  } catch (error) {
    logApiEvent({
      level: "error",
      route: "/api/chats/[id]/messages",
      requestId: rid,
      message: "post_failed",
      durationMs: Date.now() - startedAt,
      meta: { error: error instanceof Error ? error.message : String(error), ip },
    });
    return Response.json({ error: error instanceof Error ? error.message : "Could not send message" }, { status: 400 });
  }
}
