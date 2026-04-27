import { activities } from "@/db/schema";
import { lt } from "drizzle-orm";

const RETENTION_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getActivityRetentionCutoffIso(now = Date.now()): string {
  return new Date(now - RETENTION_DAYS * DAY_MS).toISOString();
}

export async function purgeClosedActivities(db: {
  delete: (table: typeof activities) => {
    where: (condition: ReturnType<typeof lt>) => Promise<unknown>;
  };
}): Promise<void> {
  const cutoffIso = getActivityRetentionCutoffIso();
  await db.delete(activities).where(lt(activities.whenISO, cutoffIso));
}

