export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityCheckins, activityCoHosts, activityParticipants, activityWaitlist, activities, follows, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { purgeClosedActivities } from "@/lib/activityRetention";
import { asc, eq, inArray } from "drizzle-orm";

type CreatePayload = {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  lat?: unknown;
  lng?: unknown;
  whenISO?: unknown;
  type?: unknown;
  visibility?: unknown;
  recurrenceRule?: unknown;
  recurrenceUntil?: unknown;
  coHostIds?: unknown;
  limit?: unknown;
};

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function cleanType(value: unknown): "chill" | "active" | "help" {
  if (value === "active" || value === "help") return value;
  return "chill";
}

function cleanVisibility(value: unknown): "public" | "friends_only" | "invite_only" {
  if (value === "friends_only" || value === "invite_only") return value;
  return "public";
}

function cleanFloat(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function cleanLimit(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  if (i < 2 || i > 200) return null;
  return i;
}

function cleanWhenISO(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function cleanRecurrenceRule(value: unknown): "none" | "weekly" | "monthly" {
  if (value === "weekly" || value === "monthly") return value;
  return "none";
}

function cleanCoHostIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value.filter((row): row is string => typeof row === "string").map((row) => row.trim()).filter(Boolean);
  return [...new Set(ids)];
}

export async function GET() {
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }
  const currentUser = await getCurrentUser();
  await purgeClosedActivities(db);
  const rows = await db.select().from(activities).orderBy(asc(activities.whenISO));

  const creatorIds = [...new Set(rows.map((row) => row.creatorId).filter((v): v is string => !!v))];
  const creators =
    creatorIds.length > 0
      ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, creatorIds))
      : [];
  const creatorMap = new Map(creators.map((c) => [c.id, c.displayName]));

  const myJoinedIds = currentUser
    ? await db
        .select({ activityId: activityParticipants.activityId })
        .from(activityParticipants)
        .where(eq(activityParticipants.userId, currentUser.id))
    : [];
  const joinedSet = new Set(myJoinedIds.map((x) => x.activityId));

  const myWaitlistIds = currentUser
    ? await db
        .select({ activityId: activityWaitlist.activityId })
        .from(activityWaitlist)
        .where(eq(activityWaitlist.userId, currentUser.id))
    : [];
  const waitlistSet = new Set(myWaitlistIds.map((x) => x.activityId));

  const myCheckins = currentUser
    ? await db
        .select({ activityId: activityCheckins.activityId })
        .from(activityCheckins)
        .where(eq(activityCheckins.userId, currentUser.id))
    : [];
  const checkinSet = new Set(myCheckins.map((x) => x.activityId));

  const myFollowingIds = currentUser
    ? await db
        .select({ followedId: follows.followedId })
        .from(follows)
        .where(eq(follows.followerId, currentUser.id))
    : [];
  const followingSet = new Set(myFollowingIds.map((row) => row.followedId));

  const visibleRows = rows.filter((row) => {
    if (row.visibility === "public") return true;
    if (!row.creatorId) return true;
    if (!currentUser) return false;
    if (row.creatorId === currentUser.id) return true;
    if (joinedSet.has(row.id)) return true;
    if (row.visibility === "friends_only") return followingSet.has(row.creatorId);
    return false;
  });

  const coHostRows =
    visibleRows.length > 0
      ? await db
          .select({ activityId: activityCoHosts.activityId, userId: activityCoHosts.userId })
          .from(activityCoHosts)
          .where(inArray(activityCoHosts.activityId, visibleRows.map((row) => row.id)))
      : [];
  const coHostByActivity = new Map<string, string[]>();
  for (const row of coHostRows) {
    const prev = coHostByActivity.get(row.activityId) ?? [];
    prev.push(row.userId);
    coHostByActivity.set(row.activityId, prev);
  }

  return Response.json(
    visibleRows.map((row) => ({
      ...row,
      creatorName: row.creatorId ? creatorMap.get(row.creatorId) ?? "Unknown" : "Unknown",
      joined: currentUser ? joinedSet.has(row.id) : false,
      waitlisted: currentUser ? waitlistSet.has(row.id) : false,
      checkedIn: currentUser ? checkinSet.has(row.id) : false,
      coHostIds: coHostByActivity.get(row.id) ?? [],
    })),
  );
}

export async function POST(req: Request) {
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }
  let body: CreatePayload;
  try {
    body = (await req.json()) as CreatePayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return Response.json({ error: "Login required" }, { status: 401 });
  }

  const title = cleanText(body.title, 80);
  const description = cleanText(body.description, 300);
  const location = cleanText(body.location, 60);
  const lat = cleanFloat(body.lat);
  const lng = cleanFloat(body.lng);
  const whenISO = cleanWhenISO(body.whenISO);
  const recurrenceRule = cleanRecurrenceRule(body.recurrenceRule);
  const recurrenceUntil = cleanWhenISO(body.recurrenceUntil);
  const coHostIds = cleanCoHostIds(body.coHostIds).filter((id) => id !== currentUser.id);
  const type = cleanType(body.type);
  const visibility = cleanVisibility(body.visibility);
  const limit = cleanLimit(body.limit);

  if (!title || !location || !whenISO || lat === null || lng === null) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [created] = await db
    .insert(activities)
    .values({
      creatorId: currentUser.id,
      title,
      description,
      location,
      lat,
      lng,
      whenISO,
      recurrenceRule: recurrenceRule === "none" ? null : recurrenceRule,
      recurrenceUntil: recurrenceRule === "none" ? null : recurrenceUntil,
      type,
      visibility,
      going: 1,
      limit,
    })
    .returning();

  await db.insert(activityParticipants).values({
    activityId: created.id,
    userId: currentUser.id,
  });

  if (coHostIds.length > 0) {
    const existingUsers = await db.select({ id: users.id }).from(users).where(inArray(users.id, coHostIds));
    if (existingUsers.length > 0) {
      await db.insert(activityCoHosts).values(existingUsers.map((row) => ({ activityId: created.id, userId: row.id })));
    }
  }

  return Response.json(
    {
      ...created,
      creatorName: currentUser.displayName,
      joined: true,
      coHostIds,
    },
    { status: 201 },
  );
}
