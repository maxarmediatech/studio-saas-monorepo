CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'converted', 'declined', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "quote_acceptances" (
	"quote_id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_option_id" varchar(255) NOT NULL,
	"option_snapshot" jsonb NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL,
	"accepted_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_items" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_option_id" varchar(255) NOT NULL,
	"type" "line_item_type" DEFAULT 'item' NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(10, 2),
	"unit_price" numeric(12, 2),
	"amount" numeric(12, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_line_items_amount_non_negative" CHECK (amount >= 0),
	CONSTRAINT "quote_line_items_shape" CHECK ((type IN ('item', 'service') AND quantity IS NOT NULL AND quantity > 0 AND unit_price IS NOT NULL AND unit_price >= 0) OR (type IN ('milestone', 'expense') AND quantity IS NULL AND unit_price IS NULL))
);
--> statement-breakpoint
CREATE TABLE "quote_options" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"booking_blueprint_version" integer DEFAULT 1 NOT NULL,
	"booking_blueprint" jsonb NOT NULL,
	"is_recommended" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_options_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "quote_options_id_org_quote_unique" UNIQUE("id","organization_id","quote_id"),
	CONSTRAINT "quote_options_amounts_non_negative" CHECK (subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0),
	CONSTRAINT "quote_options_blueprint_version_positive" CHECK (booking_blueprint_version > 0),
	CONSTRAINT "quote_options_blueprint_version_matches_payload" CHECK (CASE WHEN jsonb_typeof(booking_blueprint) = 'object' AND jsonb_typeof(booking_blueprint -> 'booking') = 'object' AND jsonb_typeof(booking_blueprint -> 'schemaVersion') = 'number' AND (booking_blueprint ->> 'schemaVersion') ~ '^[1-9][0-9]*$' THEN booking_blueprint_version = (booking_blueprint ->> 'schemaVersion')::integer ELSE false END)
);
--> statement-breakpoint
CREATE TABLE "quote_participants" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_id" varchar(255) NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"role" varchar(100) NOT NULL,
	"side" varchar(50),
	"is_primary" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" varchar(255) NOT NULL,
	"quote_number" varchar(50) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"supersedes_quote_id" varchar(255),
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"title" text NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"expires_at" timestamp with time zone,
	"terms" jsonb,
	"client_message" text,
	"internal_notes" text,
	"sent_at" timestamp with time zone,
	"converted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"superseded_at" timestamp with time zone,
	"created_by" varchar(255),
	"updated_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" varchar(255),
	CONSTRAINT "quotes_id_org_unique" UNIQUE("id","organization_id"),
	CONSTRAINT "quotes_org_number_version_unique" UNIQUE("organization_id","quote_number","version"),
	CONSTRAINT "quotes_version_positive" CHECK (version > 0),
	CONSTRAINT "quotes_currency_iso_length" CHECK (char_length(currency) = 3)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_quote_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_quote_option_id" varchar(255);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_quote_number" varchar(50);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_quote_version" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "source_booking_blueprint_version" integer;--> statement-breakpoint
-- Existing-table composite target must precede quote participant FK creation.
ALTER TABLE "clients" ADD CONSTRAINT "clients_id_org_unique" UNIQUE("id","organization_id");--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_accepted_by_users_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_acceptances" ADD CONSTRAINT "quote_acceptances_quote_option_id_organization_id_quote_id_quote_options_id_organization_id_quote_id_fk" FOREIGN KEY ("quote_option_id","organization_id","quote_id") REFERENCES "public"."quote_options"("id","organization_id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quote_option_id_organization_id_quote_options_id_organization_id_fk" FOREIGN KEY ("quote_option_id","organization_id") REFERENCES "public"."quote_options"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_options" ADD CONSTRAINT "quote_options_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_participants" ADD CONSTRAINT "quote_participants_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_participants" ADD CONSTRAINT "quote_participants_client_id_organization_id_clients_id_organization_id_fk" FOREIGN KEY ("client_id","organization_id") REFERENCES "public"."clients"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_supersedes_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("supersedes_quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quote_acceptances_option_unique_idx" ON "quote_acceptances" USING btree ("organization_id","quote_option_id");--> statement-breakpoint
CREATE INDEX "quote_line_items_option_idx" ON "quote_line_items" USING btree ("quote_option_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_options_quote_sort_idx" ON "quote_options" USING btree ("quote_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_options_recommended_unique_idx" ON "quote_options" USING btree ("quote_id") WHERE is_recommended = true;--> statement-breakpoint
CREATE INDEX "quote_options_quote_idx" ON "quote_options" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_participants_unique_idx" ON "quote_participants" USING btree ("quote_id","client_id","role");--> statement-breakpoint
CREATE INDEX "quote_participants_quote_idx" ON "quote_participants" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quote_participants_primary_unique_idx" ON "quote_participants" USING btree ("quote_id") WHERE is_primary = true;--> statement-breakpoint
CREATE INDEX "quote_participants_org_client_idx" ON "quote_participants" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_supersedes_unique_idx" ON "quotes" USING btree ("organization_id","supersedes_quote_id") WHERE supersedes_quote_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "quotes_org_status_idx" ON "quotes" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "quotes_org_expires_idx" ON "quotes" USING btree ("organization_id","expires_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY ("source_quote_id","organization_id") REFERENCES "public"."quotes"("id","organization_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_quote_option_id_organization_id_source_quote_id_quote_options_id_organization_id_quote_id_fk" FOREIGN KEY ("source_quote_option_id","organization_id","source_quote_id") REFERENCES "public"."quote_options"("id","organization_id","quote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_source_quote_idx" ON "bookings" USING btree ("organization_id","source_quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_source_quote_unique_idx" ON "bookings" USING btree ("organization_id","source_quote_id") WHERE source_quote_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_source_quote_option_unique_idx" ON "bookings" USING btree ("organization_id","source_quote_option_id") WHERE source_quote_option_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_quote_complete" CHECK ((source_quote_id IS NULL AND source_quote_option_id IS NULL AND source_quote_number IS NULL AND source_quote_version IS NULL AND source_booking_blueprint_version IS NULL) OR (source_quote_id IS NOT NULL AND source_quote_option_id IS NOT NULL AND source_quote_number IS NOT NULL AND source_quote_version IS NOT NULL AND source_booking_blueprint_version IS NOT NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_source_versions_positive" CHECK ((source_quote_version IS NULL OR source_quote_version > 0) AND (source_booking_blueprint_version IS NULL OR source_booking_blueprint_version > 0));