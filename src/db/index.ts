import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  __hangoutSql?: ReturnType<typeof postgres>;
  __hangoutDb?: ReturnType<typeof drizzle>;
};

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing env var: DATABASE_URL");

  globalForDb.__hangoutSql =
    globalForDb.__hangoutSql ??
    postgres(url, {
      // Serverless-safe: avoid prepared statements across pooled connections.
      prepare: false,
    });

  globalForDb.__hangoutDb = globalForDb.__hangoutDb ?? drizzle(globalForDb.__hangoutSql, { schema });
  return globalForDb.__hangoutDb;
}
