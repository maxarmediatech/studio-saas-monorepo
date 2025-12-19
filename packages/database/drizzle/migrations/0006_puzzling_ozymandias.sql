CREATE TABLE "assignment_submissions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"task_id" varchar(255),
	"deliverable_id" varchar(255),
	"submitted_by" varchar(255) NOT NULL,
	"status" "submission_status" DEFAULT 'draft' NOT NULL,
	"submission_note" text,
	"submitted_at" timestamp with time zone,
	"reviewed_by" varchar(255),
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_availability" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crew_feedback_summary" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"total_assignments" integer DEFAULT 0 NOT NULL,
	"completed_assignments" integer DEFAULT 0 NOT NULL,
	"average_rating" numeric(3, 2),
	"total_earnings" numeric(12, 2) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_feedback_summary_crew_id_unique" UNIQUE("crew_id")
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"daily_rate" numeric(10, 2),
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "deliverable_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"deliverable_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"assigned_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"deliverable_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"workflow_status" "workflow_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"delivered_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "shoot_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"shoot_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"role" text NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"assigned_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shoots" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"shoot_type" text NOT NULL,
	"shoot_date" date NOT NULL,
	"start_time" time,
	"end_time" time,
	"venue" text,
	"venue_address" text,
	"notes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "submission_feedback" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"feedback_by" varchar(255) NOT NULL,
	"comment" text NOT NULL,
	"rating" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission_files" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"submission_id" varchar(255) NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"task_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"assigned_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"workflow_status" "workflow_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_submitted_by_crews_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_availability" ADD CONSTRAINT "crew_availability_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crew_feedback_summary" ADD CONSTRAINT "crew_feedback_summary_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crews" ADD CONSTRAINT "crews_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD CONSTRAINT "deliverable_assignments_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD CONSTRAINT "deliverable_assignments_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverable_assignments" ADD CONSTRAINT "deliverable_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_assignments" ADD CONSTRAINT "shoot_assignments_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_assignments" ADD CONSTRAINT "shoot_assignments_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_assignments" ADD CONSTRAINT "shoot_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_feedback" ADD CONSTRAINT "submission_feedback_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_feedback" ADD CONSTRAINT "submission_feedback_feedback_by_users_id_fk" FOREIGN KEY ("feedback_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_assignment_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."assignment_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "assignment_submissions_org_idx" ON "assignment_submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_task_idx" ON "assignment_submissions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_deliverable_idx" ON "assignment_submissions" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_crew_idx" ON "assignment_submissions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "assignment_submissions_status_idx" ON "assignment_submissions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "crew_availability_crew_date_idx" ON "crew_availability" USING btree ("crew_id","date");--> statement-breakpoint
CREATE INDEX "crew_availability_date_idx" ON "crew_availability" USING btree ("date");--> statement-breakpoint
CREATE INDEX "crews_organization_idx" ON "crews" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "crews_user_idx" ON "crews" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crews_org_phone_idx" ON "crews" USING btree ("organization_id","phone_number") WHERE phone_number IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "deliverable_assignments_del_crew_idx" ON "deliverable_assignments" USING btree ("deliverable_id","crew_id");--> statement-breakpoint
CREATE INDEX "deliverable_assignments_crew_idx" ON "deliverable_assignments" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "deliverables_organization_idx" ON "deliverables" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "deliverables_booking_idx" ON "deliverables" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "deliverables_org_status_idx" ON "deliverables" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "deliverables_org_workflow_idx" ON "deliverables" USING btree ("organization_id","workflow_status");--> statement-breakpoint
CREATE INDEX "deliverables_due_date_idx" ON "deliverables" USING btree ("due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "shoot_assignments_shoot_crew_idx" ON "shoot_assignments" USING btree ("shoot_id","crew_id");--> statement-breakpoint
CREATE INDEX "shoot_assignments_crew_idx" ON "shoot_assignments" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "shoots_organization_idx" ON "shoots" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shoots_booking_idx" ON "shoots" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "shoots_date_idx" ON "shoots" USING btree ("shoot_date");--> statement-breakpoint
CREATE INDEX "shoots_org_date_idx" ON "shoots" USING btree ("organization_id","shoot_date");--> statement-breakpoint
CREATE INDEX "submission_feedback_submission_idx" ON "submission_feedback" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_files_submission_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignments_task_crew_idx" ON "task_assignments" USING btree ("task_id","crew_id");--> statement-breakpoint
CREATE INDEX "task_assignments_crew_idx" ON "task_assignments" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "tasks_organization_idx" ON "tasks" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "tasks_booking_idx" ON "tasks" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "tasks_org_status_idx" ON "tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tasks_org_workflow_idx" ON "tasks" USING btree ("organization_id","workflow_status");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");