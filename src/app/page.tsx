import HangoutApp from "./HangoutApp";
import { getDb } from "@/db";
import { activityParticipants, activities, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { asc, eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function Home() {
  let initialActivities: Array<
    typeof activities.$inferSelect & {
      creatorName: string;
      joined: boolean;
    }
  > = [];
  let initialBackendOk = false;
  const initialUser = await getCurrentUser();

  try {
    const db = getDb();
    const rows = await db.select().from(activities).orderBy(asc(activities.whenISO));
    const creatorIds = [...new Set(rows.map((row) => row.creatorId).filter((v): v is string => !!v))];
    const creators =
      creatorIds.length > 0
        ? await db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, creatorIds))
        : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c.displayName]));

    const myJoinedRows = initialUser
      ? await db
          .select({ activityId: activityParticipants.activityId })
          .from(activityParticipants)
          .where(eq(activityParticipants.userId, initialUser.id))
      : [];
    const joinedSet = new Set(myJoinedRows.map((row) => row.activityId));

    initialActivities = rows.map((row) => ({
      ...row,
      creatorName: row.creatorId ? creatorMap.get(row.creatorId) ?? "Unknown" : "Unknown",
      joined: initialUser ? joinedSet.has(row.id) : false,
    }));
    initialBackendOk = true;
  } catch {
    initialActivities = [];
    initialBackendOk = false;
  }

  return <HangoutApp initialActivities={initialActivities} initialBackendOk={initialBackendOk} initialUser={initialUser} />;
}
