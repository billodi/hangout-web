export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activityParticipants, activities, galleryEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";

type GalleryPayload = {
  imageUrl?: unknown;
  caption?: unknown;
  location?: unknown;
  lat?: unknown;
  lng?: unknown;
  activityId?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function cleanOptionalText(value: unknown, maxLen: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return "";
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function cleanFloat(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return n;
}

function cleanActivityId(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!UUID_RE.test(t)) return null;
  return t;
}

export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[id]/gallery">) {
  const { id } = await ctx.params;
  const db = getDb();
  const rows = await db
    .select({
      id: galleryEntries.id,
      userId: galleryEntries.userId,
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
  return Response.json(rows);
}

export async function POST(req: Request, ctx: RouteContext<"/api/profiles/[id]/gallery">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });
  if (currentUser.id !== id) return Response.json({ error: "You can only post to your own gallery" }, { status: 403 });
  const db = getDb();

  let body: GalleryPayload;
  try {
    body = (await req.json()) as GalleryPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = cleanText(body.imageUrl, 500);
  const caption = cleanText(body.caption, 300);
  const location = cleanOptionalText(body.location, 120);
  const lat = cleanFloat(body.lat);
  const lng = cleanFloat(body.lng);

  let activityId: string | null = null;
  if (body.activityId !== undefined && body.activityId !== null && String(body.activityId).trim() !== "") {
    activityId = cleanActivityId(body.activityId);
    if (!activityId) return Response.json({ error: "Invalid activity id" }, { status: 400 });
  }

  if (!imageUrl || !caption) return Response.json({ error: "Image URL and caption are required" }, { status: 400 });

  if (activityId) {
    const [act] = await db
      .select({ id: activities.id, creatorId: activities.creatorId })
      .from(activities)
      .where(eq(activities.id, activityId));
    if (!act) return Response.json({ error: "Activity not found" }, { status: 404 });
    const isCreator = act.creatorId === id;
    if (!isCreator) {
      const [part] = await db
        .select({ activityId: activityParticipants.activityId })
        .from(activityParticipants)
        .where(and(eq(activityParticipants.activityId, activityId), eq(activityParticipants.userId, id)));
      if (!part) {
        return Response.json({ error: "You can only link diary entries to activities you joined or created" }, { status: 403 });
      }
    }
  }

  const [created] = await db
    .insert(galleryEntries)
    .values({
      userId: id,
      activityId,
      imageUrl,
      caption,
      location,
      lat,
      lng,
    })
    .returning();

  if (!created) return Response.json({ error: "Could not create entry" }, { status: 500 });

  const [withTitle] = await db
    .select({
      id: galleryEntries.id,
      userId: galleryEntries.userId,
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
    .where(eq(galleryEntries.id, created.id));

  return Response.json(withTitle ?? created, { status: 201 });
}
