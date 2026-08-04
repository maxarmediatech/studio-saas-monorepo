ALTER TYPE "public"."config_type" RENAME TO "config_type_legacy";--> statement-breakpoint
CREATE TYPE "public"."config_type" AS ENUM(
	'task_status',
	'task_priority',
	'deliverable_status',
	'deliverable_priority',
	'crew_status',
	'crew_role',
	'shoot_status',
	'booking_type',
	'package_type',
	'relation_type',
	'expense_category',
	'event_type',
	'gst_rate',
	'quotation_terms'
);--> statement-breakpoint
ALTER TABLE "configurations"
	ALTER COLUMN "type" TYPE "public"."config_type"
	USING "type"::text::"public"."config_type";--> statement-breakpoint
DROP TYPE "public"."config_type_legacy";
