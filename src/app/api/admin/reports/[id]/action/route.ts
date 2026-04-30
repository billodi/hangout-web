export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { reportActions, reports } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";
import { and, eq } from "drizzle-orm";

type Payload = { status?: unknown; action?: unknown; details?: unknown };

function cleanText(v: unknown, max = 800): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > max) return null;
  return s;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  const { id: reportId } = await ctx.params;

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = typeof body.status === "string" ? body.status.trim() : null;
  const action = cleanText(body.action) ?? "note";
  const details = typeof body.details === "string" ? body.details.trim() : null;
  const allowedStatus = new Set(["open", "triaged", "resolved", "dismissed"]);
  if (status && !allowedStatus.has(status)) return Response.json({ error: "Invalid status" }, { status: 400 });

  const db = getDb();
  const [existing] = await db.select().from(reports).where(eq(reports.id, reportId));
  if (!existing) return Response.json({ error: "Not found" }, { status: 404 });

  if (status) {
    await db
      .update(reports)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(reports.id, reportId));
  }

  await db.insert(reportActions).values({
    reportId,
    actorUserId: admin.id,
    action,
    details: details || null,
  });

  // Notify reporter about status changes.
  if (status) {
    void createNotification({
      userId: existing.reporterUserId,
      type: "report_update",
      title: "Report update",
      body: `Your report is now “${status}”.`,
      href: "/community",
      push: true,
    });
  }

  return Response.json({ ok: true });
}

