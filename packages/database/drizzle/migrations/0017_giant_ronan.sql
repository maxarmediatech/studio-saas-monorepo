CREATE TYPE "public"."calendar_delivery_method" AS ENUM('google', 'ics');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_sync_status" AS ENUM('pending', 'synced', 'error', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."calendar_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."calendar_job_type" AS ENUM('google_create', 'google_update', 'google_delete', 'ics_send_invite', 'ics_send_update', 'ics_send_cancel');--> statement-breakpoint
CREATE TABLE "calendar_sync_jobs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"status" "calendar_job_status" DEFAULT 'pending' NOT NULL,
	"job_type" "calendar_job_type" NOT NULL,
	"payload" jsonb,
	"shoot_id" varchar(255),
	"crew_id" varchar(255),
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 5,
	"last_attempt_at" timestamp with time zone,
	"next_attempt_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "google_calendar_connections" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"google_account_email" text,
	"access_token" text,
	"refresh_token" text,
	"scope" text,
	"access_token_expires_at" timestamp with time zone,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shoot_calendar_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"shoot_id" varchar(255) NOT NULL,
	"crew_id" varchar(255) NOT NULL,
	"delivery_method" "calendar_delivery_method" DEFAULT 'google' NOT NULL,
	"calendar_id" text,
	"google_event_id" text,
	"ical_uid" text,
	"ical_sequence" integer DEFAULT 0 NOT NULL,
	"recipient_email" text,
	"sync_status" "calendar_event_sync_status" DEFAULT 'pending' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD CONSTRAINT "calendar_sync_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD CONSTRAINT "calendar_sync_jobs_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_sync_jobs" ADD CONSTRAINT "calendar_sync_jobs_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD CONSTRAINT "shoot_calendar_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD CONSTRAINT "shoot_calendar_events_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shoot_calendar_events" ADD CONSTRAINT "shoot_calendar_events_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_org_idx" ON "calendar_sync_jobs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_status_idx" ON "calendar_sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_next_attempt_idx" ON "calendar_sync_jobs" USING btree ("next_attempt_at");--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_queue_idx" ON "calendar_sync_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "calendar_sync_jobs_target_idx" ON "calendar_sync_jobs" USING btree ("shoot_id","crew_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_calendar_connections_org_user_idx" ON "google_calendar_connections" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE INDEX "google_calendar_connections_org_idx" ON "google_calendar_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "google_calendar_connections_user_idx" ON "google_calendar_connections" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shoot_calendar_events_shoot_crew_idx" ON "shoot_calendar_events" USING btree ("shoot_id","crew_id");--> statement-breakpoint
CREATE INDEX "shoot_calendar_events_org_idx" ON "shoot_calendar_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "shoot_calendar_events_shoot_idx" ON "shoot_calendar_events" USING btree ("shoot_id");--> statement-breakpoint
CREATE INDEX "shoot_calendar_events_crew_idx" ON "shoot_calendar_events" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "shoot_calendar_events_status_idx" ON "shoot_calendar_events" USING btree ("sync_status");