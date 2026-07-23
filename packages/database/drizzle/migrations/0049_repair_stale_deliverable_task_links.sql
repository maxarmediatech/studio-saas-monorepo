-- Legacy Convert to Task stored the relationship only in metadata. Migration
-- 0047 restored those relationships as reference links, including the rare
-- case where an active deliverable points at a task that was later soft-deleted.
-- The application hides deleted tasks but still treats convertedToTaskId as an
-- active conversion marker, leaving those deliverables linked to nothing and
-- unable to be converted again.
--
-- Repair only the reviewed safe shape: an active, direct-tracking deliverable
-- with reciprocal legacy metadata, a soft-deleted task, no assignment or
-- submission history on either side, and a reference link created by the
-- legacy migration. Status fields and the deleted task remain unchanged.
WITH repairable AS MATERIALIZED (
	SELECT
		link."id" AS link_id,
		deliverable."id" AS deliverable_id,
		task."id" AS task_id
	FROM "deliverable_task_links" AS link
	INNER JOIN "deliverables" AS deliverable
		ON deliverable."id" = link."deliverable_id"
		AND deliverable."organization_id" = link."organization_id"
		AND deliverable."booking_id" = link."booking_id"
	INNER JOIN "tasks" AS task
		ON task."id" = link."task_id"
		AND task."organization_id" = link."organization_id"
		AND task."booking_id" = link."booking_id"
	WHERE link."kind" = 'reference'
		AND deliverable."deleted_at" IS NULL
		AND deliverable."tracking_mode" = 'direct'
		AND deliverable."workflow_status" = 'not_started'
		AND task."deleted_at" IS NOT NULL
		AND task."workflow_status" = 'not_started'
		AND deliverable."metadata" ->> 'convertedToTaskId' = task."id"
		AND task."metadata" ->> 'convertedFromDeliverableId' = deliverable."id"
		AND NOT EXISTS (
			SELECT 1
			FROM "deliverable_assignments" AS assignment
			WHERE assignment."deliverable_id" = deliverable."id"
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "assignment_submissions" AS submission
			WHERE submission."deliverable_id" = deliverable."id"
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "task_assignments" AS assignment
			WHERE assignment."task_id" = task."id"
		)
		AND NOT EXISTS (
			SELECT 1
			FROM "assignment_submissions" AS submission
			WHERE submission."task_id" = task."id"
		)
), removed_links AS (
	DELETE FROM "deliverable_task_links" AS link
	USING repairable
	WHERE link."id" = repairable.link_id
	RETURNING link."deliverable_id", link."task_id"
)
UPDATE "deliverables" AS deliverable
SET "metadata" = nullif(
	deliverable."metadata" - 'convertedToTaskId' - 'convertedAt',
	'{}'::jsonb
)
FROM removed_links
WHERE deliverable."id" = removed_links.deliverable_id
	AND deliverable."metadata" ->> 'convertedToTaskId' = removed_links.task_id;
