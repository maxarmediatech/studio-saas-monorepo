ALTER TABLE "crews" ADD COLUMN "worker_type" text DEFAULT 'freelancer' NOT NULL;--> statement-breakpoint
UPDATE "crews"
SET "worker_type" = CASE
	WHEN "user_id" IS NOT NULL THEN 'internal'
	ELSE 'freelancer'
END;--> statement-breakpoint
CREATE INDEX "crews_worker_type_idx" ON "crews" USING btree ("worker_type");
