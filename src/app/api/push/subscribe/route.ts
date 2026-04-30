export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { rateLimitOrThrow } from "@/lib/rateLimit";
import { and, eq } from "drizzle-orm";

type Payload = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown } | unknown;
};

function cleanStr(v: unknown, max = 2000): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

export async function POST(req: Request) {
  const user = await requireUser();
  await rateLimitOrThrow({ key: `pushsub:${user.id}`, limit: 10, windowMs: 60_000 });

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = cleanStr(body.endpoint);
  const keys = typeof body.keys === "object" && body.keys ? (body.keys as any) : null;
  const p256dh = cleanStr(keys?.p256dh);
  const auth = cleanStr(keys?.auth);
  if (!endpoint || !p256dh || !auth) return Response.json({ error: "Invalid subscription" }, { status: 400 });

  const db = getDb();
  const ua = req.headers.get("user-agent");

  // Upsert by (userId, endpoint) unique index.
  const existing = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, user.id), eq(pushSubscriptions.endpoint, endpoint)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(pushSubscriptions)
      .set({ p256dh, auth, userAgent: ua })
      .where(eq(pushSubscriptions.id, existing[0].id));
    return Response.json({ ok: true });
  }

  await db.insert(pushSubscriptions).values({ userId: user.id, endpoint, p256dh, auth, userAgent: ua });
  return Response.json({ ok: true });
}

