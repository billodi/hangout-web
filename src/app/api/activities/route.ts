export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { asc, eq, inArray } from "drizzle-orm";

type CreatePayload = {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  lat?: unknown;
  lng?: unknown;
  whenISO?: unknown;
  type?: unknown;
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

export async function GET() {
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }
  const currentUser = await getCurrentUser();
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

  return Response.json(
    rows.map((row) => ({
      ...row,
      creatorName: row.creatorId ? creatorMap.get(row.creatorId) ?? "Unknown" : "Unknown",
      joined: currentUser ? joinedSet.has(row.id) : false,
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
  const type = cleanType(body.type);
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
      type,
      going: 1,
      limit,
    })
    .returning();

  await db.insert(activityParticipants).values({
    activityId: created.id,
    userId: currentUser.id,
  });

  return Response.json(
    {
      ...created,
      creatorName: currentUser.displayName,
      joined: true,
    },
    { status: 201 },
  );
}
