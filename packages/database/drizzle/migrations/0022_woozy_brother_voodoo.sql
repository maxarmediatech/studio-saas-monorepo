WITH "crew_duplicates" AS (
	SELECT
		"id",
		ROW_NUMBER() OVER (
			PARTITION BY "organization_id", "user_id"
			ORDER BY "created_at" ASC, "id" ASC
		) AS "row_num"
	FROM "crews"
	WHERE "user_id" IS NOT NULL
		AND "deleted_at" IS NULL
)
UPDATE "crews"
SET "deleted_at" = NOW()
WHERE "id" IN (
	SELECT "id"
	FROM "crew_duplicates"
	WHERE "row_num" > 1
);--> statement-breakpoint
CREATE UNIQUE INDEX "crews_org_user_active_unique" ON "crews" USING btree ("organization_id","user_id") WHERE user_id IS NOT NULL AND deleted_at IS NULL;
