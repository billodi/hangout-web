export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { clearSessionCookie, deleteSession, getCurrentSessionId } from "@/lib/auth";

export async function POST() {
  const sessionId = await getCurrentSessionId();
  if (sessionId) {
    await deleteSession(sessionId);
  }
  await clearSessionCookie();
  return Response.json({ ok: true });
}
