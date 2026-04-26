export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities, activityParticipants, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

type ReviewPayload = {
  rating?: unknown;
  comment?: unknown;
  reviewType?: unknown;
  activityId?: unknown;
};

function cleanComment(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > 500 ? t.slice(0, 500) : t;
}

function cleanRating(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 1 || i > 5) return null;
  return i;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[id]/reviews">) {
  const { id } = await ctx.params;
  const db = getDb();

  const rows = await db
    .select({
      id: reviews.id,
      targetUserId: reviews.targetUserId,
      authorUserId: reviews.authorUserId,
      rating: reviews.rating,
      comment: reviews.comment,
      activityId: reviews.activityId,
      activityTitle: activities.title,
      createdAt: reviews.createdAt,
      authorName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(reviews)
    .leftJoin(activities, eq(reviews.activityId, activities.id))
    .innerJoin(users, eq(reviews.authorUserId, users.id))
    .where(eq(reviews.targetUserId, id))
    .orderBy(desc(reviews.createdAt));

  return Response.json(
    rows.map((row) => ({
      ...row,
      reviewType: row.activityId ? "activity" : "profile",
    })),
  );
}

export async function POST(req: Request, ctx: RouteContext<"/api/profiles/[id]/reviews">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });
  if (currentUser.id === id) return Response.json({ error: "You cannot review yourself" }, { status: 400 });

  const db = getDb();
  const [target] = await db.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!target) return Response.json({ error: "Profile not found" }, { status: 404 });

  let body: ReviewPayload;
  try {
    body = (await req.json()) as ReviewPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = cleanRating(body.rating);
  const comment = cleanComment(body.comment);
  const reviewType = body.reviewType === "activity" ? "activity" : "profile";
  const activityId = typeof body.activityId === "string" ? body.activityId : null;

  if (!rating || !comment) {
    return Response.json({ error: "Rating and comment are required" }, { status: 400 });
  }

  if (reviewType === "activity" && !activityId) {
    return Response.json({ error: "Select an activity to post an activity review" }, { status: 400 });
  }

  if (reviewType === "activity" && activityId) {
    const [activity] = await db.select({ id: activities.id }).from(activities).where(eq(activities.id, activityId));
    if (!activity) return Response.json({ error: "Activity not found" }, { status: 404 });

    const memberships = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(
        and(
          eq(activityParticipants.activityId, activityId),
          eq(activityParticipants.userId, currentUser.id),
        ),
      );
    const targetMemberships = await db
      .select({ userId: activityParticipants.userId })
      .from(activityParticipants)
      .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, id)));

    if (memberships.length === 0 || targetMemberships.length === 0) {
      return Response.json({ error: "Only joined participants can review this activity" }, { status: 403 });
    }

    const [existingActivityReview] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(
        and(
          eq(reviews.targetUserId, id),
          eq(reviews.authorUserId, currentUser.id),
          eq(reviews.activityId, activityId),
        ),
      );
    if (existingActivityReview) {
      return Response.json({ error: "You already reviewed this user for that activity" }, { status: 409 });
    }
  }

  if (reviewType === "profile") {
    const sharedCountRows = await db.execute(
      sql<{ count: number }>`
        select count(*)::int as count
        from activity_participants mine
        inner join activity_participants target on target.activity_id = mine.activity_id
        where mine.user_id = ${currentUser.id} and target.user_id = ${id}
      `,
    );
    const sharedCount = Number((sharedCountRows[0] as { count?: unknown } | undefined)?.count ?? 0);
    if (sharedCount <= 0) {
      return Response.json({ error: "You can only leave a profile review after joining at least one activity together" }, { status: 403 });
    }

    const [existingProfileReview] = await db
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.targetUserId, id), eq(reviews.authorUserId, currentUser.id), isNull(reviews.activityId)));
    if (existingProfileReview) {
      return Response.json({ error: "You already posted a profile review for this user" }, { status: 409 });
    }
  }

  const [created] = await db
    .insert(reviews)
    .values({
      targetUserId: id,
      authorUserId: currentUser.id,
      activityId: reviewType === "activity" ? activityId : null,
      rating,
      comment,
    })
    .returning();

  return Response.json(created, { status: 201 });
}
