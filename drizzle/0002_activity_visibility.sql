DO $$
BEGIN
  CREATE TYPE "public"."activity_visibility" AS ENUM('public', 'friends_only', 'invite_only');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "activities"
ADD COLUMN IF NOT EXISTS "visibility" activity_visibility NOT NULL DEFAULT 'public';
