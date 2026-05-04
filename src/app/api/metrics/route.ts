export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { snapshotMetrics } from "@/lib/metrics";

export async function GET(req: Request) {
  const token = process.env.METRICS_TOKEN;
  if (token) {
    const given = req.headers.get("x-metrics-token");
    if (given !== token) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return Response.json({
    ok: true,
    time: new Date().toISOString(),
    metrics: snapshotMetrics(),
  });
}

