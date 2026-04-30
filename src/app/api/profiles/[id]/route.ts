export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, galleryEntries, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { computeBadges } from "@/lib/badges";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

type VisibleRole = "owner" | "admin" | "moderator" | null;

type UpdateProfilePayload = {
  displayName?: unknown;
  bio?: unknown;
  avatarUrl?: unknown;
};

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function cleanOptionalText(value: unknown, maxLen: number): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

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

export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  const { id } = await ctx.params;
  const db = getDb();
  const currentUser = await getCurrentUser();
  const viewerRole = currentUser?.role ?? null;
  const [profile] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, id));

  if (!profile) return Response.json({ error: "Profile not found" }, { status: 404 });
  const isCurrentUser = currentUser?.id === profile.id;

  const [createdCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activities)
    .where(eq(activities.creatorId, id));
  const [joinedCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(activityParticipants)
    .where(eq(activityParticipants.userId, id));
  const [diaryCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(galleryEntries)
    .where(eq(galleryEntries.userId, id));
  const [reviewAggRow] = await db
    .select({
      count: sql<number>`count(*)`,
      avg: sql<number>`avg(${reviews.rating})`,
    })
    .from(reviews)
    .where(eq(reviews.targetUserId, id));

  const createdCount = toNumber(createdCountRow?.count);
  const joinedCount = toNumber(joinedCountRow?.count);
  const diaryCount = toNumber(diaryCountRow?.count);
  const reviewCount = toNumber(reviewAggRow?.count);
  const avgRating = reviewCount > 0 ? Number(toNumber(reviewAggRow?.avg).toFixed(1)) : null;

  const reviewRows = await db
    .select({
      id: reviews.id,
      authorUserId: reviews.authorUserId,
      rating: reviews.rating,
      comment: reviews.comment,
      activityId: reviews.activityId,
      activityTitle: activities.title,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .leftJoin(activities, eq(reviews.activityId, activities.id))
    .where(eq(reviews.targetUserId, id))
    .orderBy(desc(reviews.createdAt));

  const reviewerIds = [...new Set(reviewRows.map((row) => row.authorUserId))];
  const reviewerRows =
    reviewerIds.length > 0
      ? await db
          .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, reviewerIds))
      : [];
  const reviewerMap = new Map(reviewerRows.map((r) => [r.id, r]));

  const gallery = await db
    .select({
      id: galleryEntries.id,
      activityId: galleryEntries.activityId,
      activityTitle: activities.title,
      imageUrl: galleryEntries.imageUrl,
      caption: galleryEntries.caption,
      location: galleryEntries.location,
      lat: galleryEntries.lat,
      lng: galleryEntries.lng,
      createdAt: galleryEntries.createdAt,
    })
    .from(galleryEntries)
    .leftJoin(activities, eq(galleryEntries.activityId, activities.id))
    .where(eq(galleryEntries.userId, id))
    .orderBy(desc(galleryEntries.createdAt));

  const recentActivities = await db
    .select({
      id: activities.id,
      title: activities.title,
      location: activities.location,
      whenISO: activities.whenISO,
      lat: activities.lat,
      lng: activities.lng,
    })
    .from(activities)
    .where(eq(activities.creatorId, id))
    .orderBy(desc(activities.createdAt));

  let reviewContext: {
    canSubmitProfileReview: boolean;
    hasProfileReview: boolean;
    eligibleActivities: Array<{ id: string; title: string; location: string; whenISO: string }>;
    reviewedActivityIds: string[];
  } | null = null;

  if (currentUser && currentUser.id !== id) {
    const sharedActivities = await db.execute<{
      id: string;
      title: string;
      location: string;
      when_iso: string;
    }>(
      sql`
        select a.id, a.title, a.location, a.when_iso
        from activities a
        inner join activity_participants mine on mine.activity_id = a.id
        inner join activity_participants target on target.activity_id = a.id
        where mine.user_id = ${currentUser.id} and target.user_id = ${id}
        order by a.when_iso desc
      `,
    );

    const myReviewRows = await db
      .select({ activityId: reviews.activityId })
      .from(reviews)
      .where(and(eq(reviews.targetUserId, id), eq(reviews.authorUserId, currentUser.id)));
    const hasProfileReview = myReviewRows.some((row) => row.activityId === null);
    const reviewedActivityIds = myReviewRows
      .map((row) => row.activityId)
      .filter((activityId): activityId is string => typeof activityId === "string");

    reviewContext = {
      canSubmitProfileReview: sharedActivities.length > 0 && !hasProfileReview,
      hasProfileReview,
      reviewedActivityIds,
      eligibleActivities: sharedActivities.map((row) => ({
        id: row.id,
        title: row.title,
        location: row.location,
        whenISO: row.when_iso,
      })),
    };
  }

  return Response.json({
    profile: {
      ...profile,
      visibleRole: getVisibleRoleForViewer(profile.role, profile.isAdmin, viewerRole, isCurrentUser),
    },
    stats: {
      createdCount,
      joinedCount,
      diaryCount,
      reviewCount,
      avgRating,
      badges: computeBadges({
        createdCount,
        joinedCount,
        diaryCount,
        reviewCount,
        avgRating,
      }),
    },
    reviews: reviewRows.map((row) => ({
      ...row,
      reviewType: row.activityId ? "activity" : "profile",
      author: reviewerMap.get(row.authorUserId) ?? null,
    })),
    gallery,
    recentActivities,
    reviewContext,
  });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/profiles/[id]">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });
  if (currentUser.id !== id) return Response.json({ error: "You can only edit your own profile" }, { status: 403 });

  let body: UpdateProfilePayload;
  try {
    body = (await req.json()) as UpdateProfilePayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const displayName = cleanText(body.displayName, 50);
  const bio = cleanOptionalText(body.bio, 300);
  const avatarUrl = cleanOptionalText(body.avatarUrl, 400);

  if (!displayName) {
    return Response.json({ error: "Display name is required" }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      displayName,
      bio: bio ?? "",
      avatarUrl: avatarUrl ?? "",
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    });

  if (!updated) return Response.json({ error: "Profile not found" }, { status: 404 });
  return Response.json(updated);
}
