export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities, activityCoHosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

type UpdatePayload = {
  title?: unknown;
  description?: unknown;
  location?: unknown;
  lat?: unknown;
  lng?: unknown;
  whenISO?: unknown;
  recurrenceRule?: unknown;
  recurrenceUntil?: unknown;
  type?: unknown;
  visibility?: unknown;
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

function cleanVisibility(value: unknown): "public" | "friends_only" | "invite_only" {
  if (value === "friends_only" || value === "invite_only") return value;
  return "public";
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
  const [isCoHost] = await db
    .select({ id: activityCoHosts.id })
    .from(activityCoHosts)
    .where(and(eq(activityCoHosts.activityId, id), eq(activityCoHosts.userId, currentUser.id)))
    .limit(1);
  if (!existing.creatorId || (existing.creatorId !== currentUser.id && !isCoHost)) {
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
  const recurrenceRule = cleanRecurrenceRule(body.recurrenceRule);
  const recurrenceUntil = cleanWhenISO(body.recurrenceUntil);
  const type = cleanType(body.type);
  const visibility = cleanVisibility(body.visibility);
  const coHostIds = cleanCoHostIds(body.coHostIds).filter((row) => row !== existing.creatorId);
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
      recurrenceRule: recurrenceRule === "none" ? null : recurrenceRule,
      recurrenceUntil: recurrenceRule === "none" ? null : recurrenceUntil,
      type,
      visibility,
      limit,
    })
    .where(eq(activities.id, id))
    .returning();

  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  if (existing.creatorId === currentUser.id) {
    await db.delete(activityCoHosts).where(eq(activityCoHosts.activityId, id));
    if (coHostIds.length > 0) {
      await db.insert(activityCoHosts).values(coHostIds.map((userId) => ({ activityId: id, userId })));
    }
  }
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
