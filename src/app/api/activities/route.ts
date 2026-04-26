export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";
import { asc } from "drizzle-orm";

type CreatePayload = {
  title?: unknown;
  location?: unknown;
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
  const rows = await db.select().from(activities).orderBy(asc(activities.whenISO));
  return Response.json(rows);
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

  const title = cleanText(body.title, 80);
  const location = cleanText(body.location, 60);
  const whenISO = cleanWhenISO(body.whenISO);
  const type = cleanType(body.type);
  const limit = cleanLimit(body.limit);

  if (!title || !location || !whenISO) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [created] = await db
    .insert(activities)
    .values({
      title,
      location,
      whenISO,
      type,
      going: 1,
      limit,
    })
    .returning();

  return Response.json(created, { status: 201 });
}
