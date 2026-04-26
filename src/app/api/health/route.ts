export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return Response.json({ ok: true, time: new Date().toISOString() });
}
