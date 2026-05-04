ALTER TABLE "activities"
ADD COLUMN IF NOT EXISTS "recurrence_rule" text,
ADD COLUMN IF NOT EXISTS "recurrence_until" timestamp with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_co_hosts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "activity_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_co_hosts" ADD CONSTRAINT "activity_co_hosts_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_co_hosts" ADD CONSTRAINT "activity_co_hosts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activity_co_hosts_activity_user_unique" ON "activity_co_hosts" USING btree ("activity_id","user_id");
