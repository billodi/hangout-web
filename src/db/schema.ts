import { integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const activityType = pgEnum("activity_type", ["chill", "active", "help"]);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  whenISO: timestamp("when_iso", { withTimezone: true, mode: "string" }).notNull(),
  type: activityType("type").notNull().default("chill"),
  going: integer("going").notNull().default(1),
  limit: integer("limit"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export type Activity = typeof activities.$inferSelect;

