CREATE TYPE "public"."deliverable_task_link_kind" AS ENUM('required', 'optional', 'reference');--> statement-breakpoint
CREATE TYPE "public"."deliverable_tracking_mode" AS ENUM('direct', 'task_based');--> statement-breakpoint
CREATE TABLE "deliverable_task_links" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"deliverable_id" varchar(255) NOT NULL,
	"task_id" varchar(255) NOT NULL,
	"kind" "deliverable_task_link_kind" DEFAULT 'required' NOT NULL,
	"created_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "tracking_mode" "deliverable_tracking_mode" DEFAULT 'direct' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "deliverables_org_booking_id_idx" ON "deliverables" USING btree ("organization_id","booking_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_org_booking_id_idx" ON "tasks" USING btree ("organization_id","booking_id","id");--> statement-breakpoint
ALTER TABLE "deliverable_task_links" ADD CONSTRAINT "deliverable_task_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_task_links" ADD CONSTRAINT "deliverable_task_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_task_links" ADD CONSTRAINT "deliverable_task_links_deliverable_scope_fk" FOREIGN KEY ("organization_id","booking_id","deliverable_id") REFERENCES "public"."deliverables"("organization_id","booking_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_task_links" ADD CONSTRAINT "deliverable_task_links_task_scope_fk" FOREIGN KEY ("organization_id","booking_id","task_id") REFERENCES "public"."tasks"("organization_id","booking_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deliverable_task_links_pair_idx" ON "deliverable_task_links" USING btree ("deliverable_id","task_id");--> statement-breakpoint
CREATE INDEX "deliverable_task_links_task_idx" ON "deliverable_task_links" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "deliverable_task_links_deliverable_idx" ON "deliverable_task_links" USING btree ("deliverable_id");--> statement-breakpoint
-- Preserve legacy convert-to-task relationships without changing their direct
-- workflow semantics. Users can promote these reference links explicitly.
INSERT INTO "deliverable_task_links" (
	"id",
	"organization_id",
	"booking_id",
	"deliverable_id",
	"task_id",
	"kind",
	"created_at"
)
SELECT
	'legacy_' || md5(d."id" || ':' || t."id"),
	d."organization_id",
	d."booking_id",
	d."id",
	t."id",
	'reference',
	COALESCE(d."updated_at", d."created_at")
FROM "deliverables" d
INNER JOIN "tasks" t
	ON t."id" = d."metadata" ->> 'convertedToTaskId'
	AND t."organization_id" = d."organization_id"
	AND t."booking_id" = d."booking_id"
WHERE d."metadata" ->> 'convertedToTaskId' IS NOT NULL
ON CONFLICT ("deliverable_id", "task_id") DO NOTHING;
