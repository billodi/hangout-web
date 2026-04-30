export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { savedSearches } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { desc, eq } from "drizzle-orm";

type Payload = { name?: unknown; query?: unknown };

function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length < 2 || s.length > 40) return null;
  return s;
}

export async function GET() {
  const user = await requireUser();
  const db = getDb();
  const rows = await db
    .select({ id: savedSearches.id, name: savedSearches.name, query: savedSearches.query, createdAt: savedSearches.createdAt })
    .from(savedSearches)
    .where(eq(savedSearches.userId, user.id))
    .orderBy(desc(savedSearches.createdAt))
    .limit(50);
  return Response.json(rows);
}

export async function POST(req: Request) {
  const user = await requireUser();
  try {
    await rateLimitOrThrow({ key: `savedsearch:${user.id}`, limit: 10, windowMs: 60_000 });
  } catch {
    return Response.json({ error: "Rate limited" }, { status: 429 });
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = cleanName(body.name);
  if (!name || body.query == null) return Response.json({ error: "Invalid payload" }, { status: 400 });

  const db = getDb();
  try {
    const [row] = await db.insert(savedSearches).values({ userId: user.id, name, query: body.query as any }).returning();
    return Response.json(row);
  } catch {
    return Response.json({ error: "Name already used" }, { status: 409 });
  }
}

