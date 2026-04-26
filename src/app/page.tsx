import HangoutApp from "./HangoutApp";
import { getDb } from "@/db";
import { activities } from "@/db/schema";
import type { Activity } from "@/db/schema";
import { asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialActivities: Activity[] = [];
  let initialBackendOk = false;

  try {
    const db = getDb();
    initialActivities = await db.select().from(activities).orderBy(asc(activities.whenISO));
    initialBackendOk = true;
  } catch {
    initialActivities = [];
    initialBackendOk = false;
  }

  return <HangoutApp initialActivities={initialActivities} initialBackendOk={initialBackendOk} />;
}
