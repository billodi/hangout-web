export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, galleryEntries, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { computeBadges } from "@/lib/badges";
import { sql } from "drizzle-orm";

type VisibleRole = "owner" | "admin" | "moderator" | null;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getVisibleRoleForViewer(
  targetRole: string,
  targetIsAdmin: number,
  viewerRole: string | null,
  isCurrentUser: boolean,
): VisibleRole {
  if (targetRole === "owner") return "owner";
  if (targetRole === "admin" || targetIsAdmin === 1) return "admin";
  if (targetRole === "moderator" && (isCurrentUser || viewerRole === "admin" || viewerRole === "owner")) {
    return "moderator";
  }
  return null;
}

export async function GET() {
  const db = getDb();
  const currentUser = await getCurrentUser();
  const viewerRole = currentUser?.role ?? null;

  const allUsers = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);

  const createdRows = await db
    .select({
      userId: activities.creatorId,
      count: sql<number>`count(*)`,
    })
    .from(activities)
    .groupBy(activities.creatorId);

  const joinedRows = await db
    .select({
      userId: activityParticipants.userId,
      count: sql<number>`count(*)`,
    })
    .from(activityParticipants)
    .groupBy(activityParticipants.userId);

  const diaryRows = await db
    .select({
      userId: galleryEntries.userId,
      count: sql<number>`count(*)`,
    })
    .from(galleryEntries)
    .groupBy(galleryEntries.userId);

  const reviewRows = await db
    .select({
      userId: reviews.targetUserId,
      count: sql<number>`count(*)`,
      avg: sql<number>`avg(${reviews.rating})`,
    })
    .from(reviews)
    .groupBy(reviews.targetUserId);

  const createdMap = new Map<string, number>();
  for (const row of createdRows) {
    if (row.userId) createdMap.set(row.userId, toNumber(row.count));
  }
  const joinedMap = new Map(joinedRows.map((row) => [row.userId, toNumber(row.count)]));
  const diaryMap = new Map(diaryRows.map((row) => [row.userId, toNumber(row.count)]));
  const reviewMap = new Map(reviewRows.map((row) => [row.userId, { count: toNumber(row.count), avg: toNumber(row.avg) }]));

  const items = allUsers.map((user) => {
    const isCurrentUser = currentUser?.id === user.id;
    const createdCount = createdMap.get(user.id) ?? 0;
    const joinedCount = joinedMap.get(user.id) ?? 0;
    const diaryCount = diaryMap.get(user.id) ?? 0;
    const review = reviewMap.get(user.id) ?? { count: 0, avg: 0 };
    const avgRating = review.count > 0 ? Number(review.avg.toFixed(1)) : null;
    const badges = computeBadges({
      createdCount,
      joinedCount,
      diaryCount,
      reviewCount: review.count,
      avgRating,
    });

    return {
      ...user,
      createdCount,
      joinedCount,
      diaryCount,
      reviewCount: review.count,
      avgRating,
      badges,
      isCurrentUser,
      visibleRole: getVisibleRoleForViewer(user.role, user.isAdmin, viewerRole, isCurrentUser),
    };
  });

  return Response.json(items);
}
