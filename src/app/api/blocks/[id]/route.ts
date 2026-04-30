export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { blocks } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, eq } from "drizzle-orm";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: targetUserId } = await ctx.params;
  const user = await requireUser();
  if (targetUserId === user.id) return Response.json({ error: "Cannot block yourself" }, { status: 400 });

  try {
    await rateLimitOrThrow({ key: `block:${user.id}`, limit: 20, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  const db = getDb();
  const [existing] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(and(eq(blocks.blockerId, user.id), eq(blocks.blockedId, targetUserId)))
    .limit(1);

  if (existing) {
    await db.delete(blocks).where(eq(blocks.id, existing.id));
    return Response.json({ blocked: false });
  }

  await db.insert(blocks).values({ blockerId: user.id, blockedId: targetUserId });
  return Response.json({ blocked: true });
}

