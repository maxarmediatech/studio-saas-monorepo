DROP INDEX "bookings_org_ref_idx";--> statement-breakpoint
ALTER TABLE "booking_events" ADD COLUMN "organization_id" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_events_org_date_idx" ON "booking_events" USING btree ("organization_id","event_date");--> statement-breakpoint
CREATE INDEX "booking_participants_client_idx" ON "booking_participants" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "configurations_org_type_default_idx" ON "configurations" USING btree ("organization_id","type") WHERE is_default = true;--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_org_ref_idx" ON "bookings" USING btree ("organization_id","reference_number") WHERE deleted_at IS NULL;