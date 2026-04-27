export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

type UpdatePayload = {
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

export async function PATCH(req: Request, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [existing] = await db.select().from(activities).where(eq(activities.id, id));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (!existing.creatorId || existing.creatorId !== currentUser.id) {
    return Response.json({ error: "Only the creator can edit this activity" }, { status: 403 });
  }

  let body: UpdatePayload;
  try {
    body = (await req.json()) as UpdatePayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
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

  const [updated] = await db
    .update(activities)
    .set({
      title,
      description,
      location,
      lat,
      lng,
      whenISO,
      type,
      limit,
    })
    .where(eq(activities.id, id))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(updated);
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/activities/[id]">) {
  const { id } = await ctx.params;
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Login required" }, { status: 401 });

  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "DB not configured" }, { status: 500 });
  }

  const [existing] = await db.select().from(activities).where(eq(activities.id, id));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });
  if (!existing.creatorId || existing.creatorId !== currentUser.id) {
    return Response.json({ error: "Only the creator can delete this activity" }, { status: 403 });
  }

  await db.delete(activities).where(eq(activities.id, id));
  return Response.json({ ok: true });
}
