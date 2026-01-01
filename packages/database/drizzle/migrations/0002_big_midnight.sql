ALTER TABLE "deliverables" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "cost" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "deliverables" ADD COLUMN "is_package_included" boolean DEFAULT false NOT NULL;