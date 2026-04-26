export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ user: null });
  return Response.json({ user });
}
