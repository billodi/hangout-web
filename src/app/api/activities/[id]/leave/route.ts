export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function POST(_req: Request, ctx: RouteContext<"/api/activities/[id]/leave">) {
  const { id } = await ctx.params;
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [updated] = await db
    .update(activities)
    .set({ going: sql`GREATEST(${activities.going} - 1, 0)` })
    .where(eq(activities.id, id))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}
