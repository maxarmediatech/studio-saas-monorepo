CREATE TYPE "public"."assignment_progress_status" AS ENUM('assigned', 'in_progress', 'blocked');--> statement-breakpoint
ALTER TYPE "public"."workflow_status" ADD VALUE 'in_progress' BEFORE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."workflow_status" ADD VALUE 'blocked' BEFORE 'submitted';--> statement-breakpoint
ALTER TYPE "public"."workflow_status" ADD VALUE 'ready' BEFORE 'approved';--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD COLUMN "progress_status" "assignment_progress_status" DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD COLUMN "progress_note" text;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
-- Before this migration, internal approval was the only studio workflow that
-- wrote delivered_at. Preserve that history as completion and free
-- delivered_at for an explicit client-delivery action.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "deliverables"
		WHERE "delivered_at" IS NOT NULL
			AND "workflow_status" <> 'approved'
	) THEN
		RAISE EXCEPTION '0046 cannot reinterpret delivered_at: non-approved legacy rows require manual review';
	END IF;
END $$;--> statement-breakpoint
UPDATE "deliverables"
SET "completed_at" = "delivered_at", "delivered_at" = NULL
WHERE "delivered_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD COLUMN "progress_status" "assignment_progress_status" DEFAULT 'assigned' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD COLUMN "progress_note" text;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
