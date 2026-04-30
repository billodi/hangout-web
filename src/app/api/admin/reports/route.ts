export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { reports, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  await requireAdmin();
  const db = getDb();
  const rows = await db
    .select({
      id: reports.id,
      reporterUserId: reports.reporterUserId,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      updatedAt: reports.updatedAt,
      reporter: { id: users.id, displayName: users.displayName, email: users.email },
    })
    .from(reports)
    .innerJoin(users, eq(reports.reporterUserId, users.id))
    .orderBy(desc(reports.createdAt))
    .limit(120);

  return Response.json({ reports: rows });
}

