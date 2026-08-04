ALTER TABLE "shoots" ADD COLUMN "booking_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "shoots" ADD COLUMN "side" "event_side";--> statement-breakpoint
ALTER TABLE "shoots" ADD CONSTRAINT "shoots_booking_event_id_booking_events_id_fk" FOREIGN KEY ("booking_event_id") REFERENCES "public"."booking_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shoots_booking_event_idx" ON "shoots" USING btree ("booking_event_id");