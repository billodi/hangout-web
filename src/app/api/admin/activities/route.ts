export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities, activityParticipants } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

type Action = "delete" | "hide";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner")) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  let body: { action: Action; activityId: string };
  
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, activityId } = body;

  switch (action) {
    case "delete": {
      // Delete activity and all participants
      await db.delete(activityParticipants).where(eq(activityParticipants.activityId, activityId));
      await db.delete(activities).where(eq(activities.id, activityId));
      return Response.json({ success: true, message: "Activity deleted" });
    }

    case "hide": {
      // Could add a hidden flag, for now just delete
      await db.delete(activityParticipants).where(eq(activityParticipants.activityId, activityId));
      await db.delete(activities).where(eq(activities.id, activityId));
      return Response.json({ success: true, message: "Activity removed" });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}