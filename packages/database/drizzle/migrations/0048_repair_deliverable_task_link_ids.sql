-- Migration 0047 backfilled legacy conversion links with deterministic IDs that
-- do not satisfy the UUID-shaped public API contract. Repair every malformed
-- link ID in place; foreign keys reference the deliverable/task pair, not this ID.
UPDATE "deliverable_task_links"
SET "id" = gen_random_uuid()::text
WHERE left("id", 7) = 'legacy_';
