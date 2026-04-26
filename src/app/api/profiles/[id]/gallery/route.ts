export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { galleryEntries } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

type GalleryPayload = {
  imageUrl?: unknown;
  caption?: unknown;
  location?: unknown;
  lat?: unknown;
  lng?: unknown;
};

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

export async function GET(_req: Request, ctx: RouteContext<"/api/profiles/[id]/gallery">) {
  const { id } = await ctx.params;
  const db = getDb();
  const rows = await db
    .select()
    .from(galleryEntries)
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

  if (!imageUrl || !caption) return Response.json({ error: "Image URL and caption are required" }, { status: 400 });

  const [created] = await db
    .insert(galleryEntries)
    .values({
      userId: id,
      imageUrl,
      caption,
      location,
      lat,
      lng,
    })
    .returning();

  return Response.json(created, { status: 201 });
}
