export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities, activityMessages } from "@/db/schema";
import { isStaff, requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; messageId: string }> }) {
  const { id: activityId, messageId } = await ctx.params;
  const user = await requireUser();
  const db = getDb();

  const [row] = await db
    .select({
      messageId: activityMessages.id,
      authorUserId: activityMessages.authorUserId,
      creatorId: activities.creatorId,
    })
    .from(activityMessages)
    .innerJoin(activities, eq(activityMessages.activityId, activities.id))
    .where(and(eq(activityMessages.id, messageId), eq(activityMessages.activityId, activityId)));

  if (!row) return Response.json({ error: "Not found" }, { status: 404 });

  const canDelete = row.authorUserId === user.id || row.creatorId === user.id || isStaff(user);
  if (!canDelete) return Response.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(activityMessages).where(eq(activityMessages.id, messageId));
  return Response.json({ ok: true });
}

