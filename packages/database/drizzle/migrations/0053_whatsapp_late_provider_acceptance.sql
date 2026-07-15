ALTER TABLE "wa_outbox" ADD COLUMN "dispatch_token" text;--> statement-breakpoint
CREATE INDEX "wa_outbox_dispatch_token_idx" ON "wa_outbox" USING btree ("dispatch_token");