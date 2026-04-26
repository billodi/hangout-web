export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [existing] = await db.select().from(activities).where(eq(activities.id, id));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (!existing.creatorId || existing.creatorId !== currentUser.id) {
    return Response.json({ error: "Only the creator can delete this activity" }, { status: 403 });
  }

  await db.delete(activities).where(eq(activities.id, id));
  return Response.json({ ok: true });
}
