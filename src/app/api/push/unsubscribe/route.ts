export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

type Payload = { endpoint?: unknown };

function cleanEndpoint(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 2000) return null;
  return s;
}

export async function POST(req: Request) {
  const user = await requireUser();

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = cleanEndpoint(body.endpoint);
  if (!endpoint) return Response.json({ error: "Endpoint required" }, { status: 400 });

  const db = getDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)));
  return Response.json({ ok: true });
}

