export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatThreads } from "@/db/schema";
import { requireUser } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, props: Params) {
  try {
    const me = await requireUser();
    const { id } = await props.params;
    const db = getDb();

    const [thread] = await db
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, id), or(eq(chatThreads.userLowId, me.id), eq(chatThreads.userHighId, me.id))))
      .limit(1);

    if (!thread) return Response.json({ error: "Not found" }, { status: 404 });

    await db
      .update(chatMessages)
      .set({ readAt: new Date().toISOString() })
      .where(and(eq(chatMessages.threadId, id), isNull(chatMessages.readAt), eq(chatMessages.authorUserId, thread.userLowId === me.id ? thread.userHighId : thread.userLowId)));

    return Response.json({ ok: true });
  } catch (error) {
    console.error("POST /api/chats/[id]/read failed", error);
    return Response.json({ error: "Could not mark read" }, { status: 500 });
  }
}
