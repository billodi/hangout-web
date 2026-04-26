export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReviewPayload = {
  rating?: unknown;
  comment?: unknown;
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

export async function GET(_req: Request, ctx: RouteContext) {
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
      createdAt: reviews.createdAt,
      authorName: users.displayName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(reviews)
    .innerJoin(users, eq(reviews.authorUserId, users.id))
    .where(eq(reviews.targetUserId, id))
    .orderBy(desc(reviews.createdAt));

  return Response.json(rows);
}

export async function POST(req: Request, ctx: RouteContext) {
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
  const activityId = typeof body.activityId === "string" ? body.activityId : null;

  if (!rating || !comment) {
    return Response.json({ error: "Rating and comment are required" }, { status: 400 });
  }

  const [created] = await db
    .insert(reviews)
    .values({
      targetUserId: id,
      authorUserId: currentUser.id,
      activityId,
      rating,
      comment,
    })
    .returning();

  return Response.json(created, { status: 201 });
}
