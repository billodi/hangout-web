export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner")) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();

  // Get all users (including admins)
  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} desc`);

  // Get activity stats
  const [totalActivities] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities);

  const [totalParticipants] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityParticipants);

  // Get recent activities
  const recentActivities = await db
    .select({
      id: activities.id,
      title: activities.title,
      location: activities.location,
      type: activities.type,
      whenISO: activities.whenISO,
      going: activities.going,
      limit: activities.limit,
      createdAt: activities.createdAt,
      creatorId: activities.creatorId,
    })
    .from(activities)
    .orderBy(sql`${activities.createdAt} desc`)
    .limit(20);

  // Get creator names for activities
  const creatorIds = [...new Set(recentActivities.map(a => a.creatorId).filter(Boolean))];
  const creatorRows = creatorIds.length > 0
    ? await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(sql`${users.id} IN (${creatorIds.map(() => '?').join(',')})`)
    : [];
  const creatorMap = new Map(creatorRows.map(c => [c.id, c.displayName]));

  const activitiesWithCreator = recentActivities.map(a => ({
    ...a,
    creatorName: a.creatorId ? creatorMap.get(a.creatorId) ?? "Unknown" : null,
  }));

  return Response.json({
    stats: {
      totalUsers: allUsers.length,
      totalActivities: totalActivities?.count ?? 0,
      totalParticipants: totalParticipants?.count ?? 0,
    },
    users: allUsers,
    recentActivities: activitiesWithCreator,
  });
}