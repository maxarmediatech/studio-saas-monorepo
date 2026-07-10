ALTER TABLE "assignment_submissions" ADD COLUMN "review_claimed_at" timestamp with time zone;--> statement-breakpoint
UPDATE "assignment_submissions"
SET "review_claimed_at" = COALESCE("reviewed_at", "updated_at", "submitted_at", "created_at")
WHERE "status" = 'in_review'
  AND "reviewed_by" IS NOT NULL
  AND "review_claimed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "assignment_submissions_review_claim_idx" ON "assignment_submissions" USING btree ("organization_id","status","review_claimed_at");
