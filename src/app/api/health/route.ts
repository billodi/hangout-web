export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { activities } from "@/db/schema";

export async function GET() {
  try {
    const db = getDb();
    await db.select().from(activities).limit(1);
    return Response.json({ ok: true, db: "connected", time: new Date().toISOString() });
  } catch (error) {
    return Response.json({ 
      ok: false, 
      db: "error", 
      error: error instanceof Error ? error.message : String(error),
      time: new Date().toISOString() 
    }, { status: 500 });
  }
}
