export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { savedSearches } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await ctx.params;
  const db = getDb();
  await db.delete(savedSearches).where(and(eq(savedSearches.userId, user.id), eq(savedSearches.id, id)));
  return Response.json({ ok: true });
}

