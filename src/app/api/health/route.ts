export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";

export async function GET() {
  let db;
  try {
    db = getDb();
  } catch (e) {
    return Response.json({ 
      ok: false, 
      step: "getDb", 
      error: e instanceof Error ? e.message : String(e),
      time: new Date().toISOString() 
    }, { status: 500 });
  }

  try {
    const result = await db.select({ id: activities.id }).from(activities).limit(1);
    return Response.json({ ok: true, db: "connected", rows: result.length, time: new Date().toISOString() });
  } catch (error) {
    return Response.json({ 
      ok: false, 
      step: "select",
      error: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? error.cause : undefined,
      time: new Date().toISOString() 
    }, { status: 500 });
  }
}
