CREATE TABLE "wa_manual_send_idempotency" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_fingerprint" varchar(64) NOT NULL,
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"message_id" varchar(255),
	"outbox_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "wa_manual_send_idempotency_status_check" CHECK (status IN ('processing', 'completed')),
	CONSTRAINT "wa_manual_send_idempotency_completion_check" CHECK ((status = 'processing' AND message_id IS NULL AND outbox_id IS NULL AND completed_at IS NULL) OR (status = 'completed' AND message_id IS NOT NULL AND outbox_id IS NOT NULL AND completed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "wa_manual_send_idempotency_scope_key_idx" ON "wa_manual_send_idempotency" USING btree ("organization_id","actor_id","account_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "wa_manual_send_idempotency_message_idx" ON "wa_manual_send_idempotency" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "wa_manual_send_idempotency_outbox_idx" ON "wa_manual_send_idempotency" USING btree ("outbox_id");
