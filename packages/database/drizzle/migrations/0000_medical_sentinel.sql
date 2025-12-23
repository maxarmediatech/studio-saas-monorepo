CREATE TYPE "public"."bill_to" AS ENUM('studio', 'client');--> statement-breakpoint
CREATE TYPE "public"."booking_phase" AS ENUM('new', 'preparation', 'shooting', 'delivery', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."config_type" AS ENUM('task_status', 'task_priority', 'deliverable_status', 'deliverable_priority', 'crew_status', 'shoot_status', 'booking_type', 'package_type', 'relation_type', 'expense_category');--> statement-breakpoint
CREATE TYPE "public"."conversation_status" AS ENUM('active', 'archived', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('sent', 'delivered', 'read', 'failed');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('text', 'image', 'document', 'audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."participant_type" AS ENUM('crew', 'client');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_schedule_status" AS ENUM('pending', 'partial', 'completed', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."purchaseType" AS ENUM('SUBSCRIPTION', 'ONE_TIME');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'revision_requested');--> statement-breakpoint
CREATE TYPE "public"."workflow_status" AS ENUM('not_started', 'assigned', 'submitted', 'in_review', 'revision_requested', 'approved');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"expires_at" timestamp with time zone,
	"password" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"active_organization_id" text,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "two_factors" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text,
	"display_username" text,
	"role" text,
	"banned" boolean,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"onboarding_complete" boolean DEFAULT false NOT NULL,
	"payments_customer_id" text,
	"locale" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"logo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" text,
	"payments_customer_id" text
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text,
	"user_id" text,
	"type" "purchaseType" NOT NULL,
	"customer_id" text NOT NULL,
	"subscription_id" text,
	"payment_id" text,
	"product_id" text NOT NULL,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "purchases_subscription_id_unique" UNIQUE("subscription_id"),
	CONSTRAINT "purchases_payment_id_unique" UNIQUE("payment_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignment_submissions_task_or_deliverable" CHECK ((task_id IS NOT NULL AND deliverable_id IS NULL) OR (task_id IS NULL AND deliverable_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(255) NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"description" text,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"event_type" text NOT NULL,
	"event_date" date NOT NULL,
	"venue" text,
	"venue_address" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_participants" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"reference_number" varchar(50) NOT NULL,
	"name" text NOT NULL,
	"booking_type" text NOT NULL,
	"package_type" text NOT NULL,
	"package_cost" numeric(12, 2) NOT NULL,
	"status" "booking_phase" DEFAULT 'new' NOT NULL,
	"total_received" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_expenses" numeric(12, 2) DEFAULT '0' NOT NULL,
	"note" text,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"alternate_phone" text,
	"address" text,
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "configurations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"type" "config_type" NOT NULL,
	"key" varchar(100) NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"color" varchar(20),
	"icon" varchar(50),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
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
CREATE TABLE "expense_assignments" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"expense_id" varchar(255) NOT NULL,
	"booking_id" varchar(255),
	"shoot_id" varchar(255),
	"crew_id" varchar(255),
	"allocation_percentage" numeric(5, 2),
	"allocation_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_assignments_single_target" CHECK ((booking_id IS NOT NULL AND shoot_id IS NULL AND crew_id IS NULL) OR (booking_id IS NULL AND shoot_id IS NOT NULL AND crew_id IS NULL) OR (booking_id IS NULL AND shoot_id IS NULL AND crew_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category" text,
	"expense_date" date NOT NULL,
	"bill_to" "bill_to" DEFAULT 'studio' NOT NULL,
	"payment_method" "payment_method",
	"transaction_reference" varchar(100),
	"vendor" text,
	"notes" text,
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "expenses_amount_positive" CHECK (amount > 0)
);
--> statement-breakpoint
CREATE TABLE "invoice_line_items" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"invoice_id" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_line_items_quantity_positive" CHECK (quantity > 0),
	CONSTRAINT "invoice_line_items_unit_price_non_negative" CHECK (unit_price >= 0),
	CONSTRAINT "invoice_line_items_amount_consistency" CHECK (amount = quantity * unit_price)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"terms" text,
	"sent_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"metadata" jsonb,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "invoices_amounts_non_negative" CHECK (subtotal >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0),
	CONSTRAINT "invoices_paid_amount_range" CHECK (paid_amount >= 0 AND paid_amount <= total_amount)
);
--> statement-breakpoint
CREATE TABLE "payment_schedules" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" "payment_schedule_status" DEFAULT 'pending' NOT NULL,
	"paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"paid_at" timestamp with time zone,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "payment_schedules_amount_positive" CHECK (amount > 0),
	CONSTRAINT "payment_schedules_paid_amount_range" CHECK (paid_amount >= 0 AND paid_amount <= amount)
);
--> statement-breakpoint
CREATE TABLE "received_amounts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"booking_id" varchar(255) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"transaction_reference" varchar(100),
	"received_date" date NOT NULL,
	"notes" text,
	"payment_schedule_id" varchar(255),
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "received_amounts_amount_positive" CHECK (amount > 0)
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submission_feedback_rating_range" CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
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
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factors" ADD CONSTRAINT "two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_deliverable_id_deliverables_id_fk" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_submitted_by_crews_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "configurations" ADD CONSTRAINT "configurations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "expense_assignments" ADD CONSTRAINT "expense_assignments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_assignments" ADD CONSTRAINT "expense_assignments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_assignments" ADD CONSTRAINT "expense_assignments_shoot_id_shoots_id_fk" FOREIGN KEY ("shoot_id") REFERENCES "public"."shoots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_assignments" ADD CONSTRAINT "expense_assignments_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_schedules" ADD CONSTRAINT "payment_schedules_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_payment_schedule_id_payment_schedules_id_fk" FOREIGN KEY ("payment_schedule_id") REFERENCES "public"."payment_schedules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "received_amounts" ADD CONSTRAINT "received_amounts_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
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
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "two_factors_user_id_idx" ON "two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_user_org_idx" ON "members" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_webhook_id_idx" ON "webhook_events" USING btree ("webhook_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_org_idx" ON "assignment_submissions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_task_idx" ON "assignment_submissions" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_deliverable_idx" ON "assignment_submissions" USING btree ("deliverable_id");--> statement-breakpoint
CREATE INDEX "assignment_submissions_crew_idx" ON "assignment_submissions" USING btree ("submitted_by");--> statement-breakpoint
CREATE INDEX "assignment_submissions_status_idx" ON "assignment_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attachments_org_idx" ON "attachments" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_events_org_date_idx" ON "booking_events" USING btree ("organization_id","event_date");--> statement-breakpoint
CREATE INDEX "booking_events_date_idx" ON "booking_events" USING btree ("event_date");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_participants_uniq_idx" ON "booking_participants" USING btree ("booking_id","client_id","role");--> statement-breakpoint
CREATE INDEX "booking_participants_booking_idx" ON "booking_participants" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_participants_client_idx" ON "booking_participants" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_id_org_idx" ON "bookings" USING btree ("id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_ref_idx" ON "bookings" USING btree ("organization_id","reference_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "bookings_org_status_idx" ON "bookings" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "bookings_org_created_idx" ON "bookings" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "clients_organization_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_phone_idx" ON "clients" USING btree ("organization_id","phone_number") WHERE phone_number IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_org_email_idx" ON "clients" USING btree ("organization_id","email") WHERE email IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "configurations_org_type_key_idx" ON "configurations" USING btree ("organization_id","type","key");--> statement-breakpoint
CREATE UNIQUE INDEX "configurations_org_type_default_idx" ON "configurations" USING btree ("organization_id","type") WHERE is_default = true;--> statement-breakpoint
CREATE INDEX "configurations_org_type_idx" ON "configurations" USING btree ("organization_id","type");--> statement-breakpoint
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
CREATE INDEX "expense_assignments_expense_idx" ON "expense_assignments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "expense_assignments_booking_idx" ON "expense_assignments" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "expense_assignments_shoot_idx" ON "expense_assignments" USING btree ("shoot_id");--> statement-breakpoint
CREATE INDEX "expense_assignments_crew_idx" ON "expense_assignments" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "expenses_org_idx" ON "expenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "expenses_date_idx" ON "expenses" USING btree ("expense_date");--> statement-breakpoint
CREATE INDEX "expenses_org_date_idx" ON "expenses" USING btree ("organization_id","expense_date");--> statement-breakpoint
CREATE INDEX "expenses_category_idx" ON "expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "expenses_bill_to_idx" ON "expenses" USING btree ("bill_to");--> statement-breakpoint
CREATE INDEX "invoice_line_items_invoice_idx" ON "invoice_line_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_org_number_idx" ON "invoices" USING btree ("organization_id","invoice_number") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invoices_booking_idx" ON "invoices" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_issue_date_idx" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "payment_schedules_org_idx" ON "payment_schedules" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_schedules_booking_idx" ON "payment_schedules" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "payment_schedules_due_date_idx" ON "payment_schedules" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "payment_schedules_status_idx" ON "payment_schedules" USING btree ("status");--> statement-breakpoint
CREATE INDEX "received_amounts_org_idx" ON "received_amounts" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "received_amounts_booking_idx" ON "received_amounts" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "received_amounts_date_idx" ON "received_amounts" USING btree ("received_date");--> statement-breakpoint
CREATE INDEX "received_amounts_schedule_idx" ON "received_amounts" USING btree ("payment_schedule_id");--> statement-breakpoint
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