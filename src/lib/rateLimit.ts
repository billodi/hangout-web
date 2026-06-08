import { addMilliseconds, startOfMinute } from "@/lib/time";
import { getDb } from "@/db";
import { rateLimitBuckets } from "@/db/schema";
import { sql } from "drizzle-orm";

export type RateLimitPolicy = {
  key: string;
  limit: number;
  windowMs: number;
};

export class RateLimitError extends Error {
  readonly status = 429;
  readonly resetAtIso: string;

  constructor(resetAtIso: string) {
    super("Rate limited");
    this.name = "RateLimitError";
    this.resetAtIso = resetAtIso;
  }
}

export function rateLimitResponse(error: unknown): Response {
  const status = error instanceof RateLimitError ? error.status : 429;
  return Response.json({ error: "Rate limited" }, { status });
}

function windowStartIso(now: Date, windowMs: number): string {
  if (windowMs <= 60_000) {
    return startOfMinute(now).toISOString();
  }
  const t = now.getTime();
  const w = Math.floor(t / windowMs) * windowMs;
  return new Date(w).toISOString();
}

/**
 * Postgres-backed rate limit. Safe for serverless because the counter lives in DB.
 * Returns remaining tokens (>= 0). Throws when exceeded.
 */
export async function rateLimitOrThrow(policy: RateLimitPolicy): Promise<{ remaining: number; resetAtIso: string }> {
  const db = getDb();
  const now = new Date();
  const startIso = windowStartIso(now, policy.windowMs);
  const resetAtIso = addMilliseconds(new Date(startIso), policy.windowMs).toISOString();

  const [row] = await db
    .insert(rateLimitBuckets)
    .values({ key: policy.key, windowStart: startIso, count: 1 })
    .onConflictDoUpdate({
      target: [rateLimitBuckets.key, rateLimitBuckets.windowStart],
      set: { count: sql`${rateLimitBuckets.count} + 1` },
    })
    .returning({ count: rateLimitBuckets.count });

  const remaining = Math.max(0, policy.limit - (row?.count ?? policy.limit));
  if ((row?.count ?? 0) > policy.limit) {
    throw new RateLimitError(resetAtIso);
  }

  return { remaining, resetAtIso };
}
