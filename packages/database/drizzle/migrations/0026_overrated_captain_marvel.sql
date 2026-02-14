CREATE TYPE "public"."checkin_scope" AS ENUM('organization', 'team');
--> statement-breakpoint
ALTER TABLE "checkin_types" ALTER COLUMN "team_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "checkin_types" ADD COLUMN "scope" "checkin_scope" DEFAULT 'organization' NOT NULL;
--> statement-breakpoint
UPDATE "checkin_types"
SET "scope" = 'team'
WHERE "team_id" IS NOT NULL
	AND "scope" <> 'team';
--> statement-breakpoint
ALTER TABLE "checkin_types" ADD CONSTRAINT "checkin_types_scope_team_constraint" CHECK (
	(
		"checkin_types"."scope" = 'team'
		AND "checkin_types"."team_id" IS NOT NULL
	)
	OR (
		"checkin_types"."scope" = 'organization'
		AND "checkin_types"."team_id" IS NULL
	)
);
