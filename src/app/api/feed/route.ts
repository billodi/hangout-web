export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, follows, galleryEntries, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, desc, eq, gt, inArray } from "drizzle-orm";

export async function GET(req: Request) {
  const me = await requireUser();
  const db = getDb();
  const followingOnly = new URL(req.url).searchParams.get("followingOnly") === "1";

  const followRows = await db.select({ followedId: follows.followedId }).from(follows).where(eq(follows.followerId, me.id));
  const followedIds = followRows.map((r) => r.followedId);
  const nowIso = new Date().toISOString();

  const feedActivities =
    followingOnly && followedIds.length === 0
      ? []
      : await db
          .select({
            id: activities.id,
            creatorId: activities.creatorId,
            title: activities.title,
            description: activities.description,
            location: activities.location,
            lat: activities.lat,
            lng: activities.lng,
            whenISO: activities.whenISO,
            type: activities.type,
            going: activities.going,
            limit: activities.limit,
            createdAt: activities.createdAt,
            creatorName: users.displayName,
          })
          .from(activities)
          .innerJoin(users, eq(activities.creatorId, users.id))
          .where(
            followingOnly
              ? and(inArray(activities.creatorId, followedIds), gt(activities.whenISO, nowIso))
              : and(eq(activities.visibility, "public"), gt(activities.whenISO, nowIso)),
          )
          .orderBy(desc(activities.createdAt))
          .limit(40);

  const activityIds = feedActivities.map((a) => a.id);
  const joinedRows =
    activityIds.length === 0
      ? []
      : await db
          .select({ activityId: activityParticipants.activityId })
          .from(activityParticipants)
          .where(and(inArray(activityParticipants.activityId, activityIds), eq(activityParticipants.userId, me.id)));

  const joinedSet = new Set(joinedRows.filter((r) => r.activityId).map((r) => r.activityId as string));

  const feedDiary =
    followedIds.length === 0
      ? []
      : await db
          .select({
            id: galleryEntries.id,
            userId: galleryEntries.userId,
            imageUrl: galleryEntries.imageUrl,
            caption: galleryEntries.caption,
            location: galleryEntries.location,
            lat: galleryEntries.lat,
            lng: galleryEntries.lng,
            activityId: galleryEntries.activityId,
            activityTitle: activities.title,
            createdAt: galleryEntries.createdAt,
            authorName: users.displayName,
            authorAvatarUrl: users.avatarUrl,
          })
          .from(galleryEntries)
          .innerJoin(users, eq(galleryEntries.userId, users.id))
          .leftJoin(activities, eq(galleryEntries.activityId, activities.id))
          .where(inArray(galleryEntries.userId, followedIds))
          .orderBy(desc(galleryEntries.createdAt))
          .limit(40);

  return Response.json({
    activities: feedActivities.map((a) => ({ ...a, joined: joinedSet.has(a.id) })),
    diary: feedDiary,
  });
}
