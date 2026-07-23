\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		coalesce(max(created_at), 0) AS latest_created_at,
		coalesce((array_agg(hash ORDER BY created_at DESC))[1], '') AS latest_hash,
		coalesce(md5(string_agg(hash, ',' ORDER BY created_at)), '') AS ledger_digest
	FROM drizzle.__drizzle_migrations
), schema_state AS (
	SELECT
		(
			SELECT count(*)
			FROM pg_type AS type
			INNER JOIN pg_namespace AS namespace
				ON namespace.oid = type.typnamespace
			WHERE namespace.nspname = 'public'
				AND type.typname IN (
					'assignment_progress_status',
					'deliverable_task_link_kind',
					'deliverable_tracking_mode'
				)
		) AS new_type_count,
		(
			SELECT count(*)
			FROM pg_enum AS enum_value
			INNER JOIN pg_type AS type ON type.oid = enum_value.enumtypid
			INNER JOIN pg_namespace AS namespace
				ON namespace.oid = type.typnamespace
			WHERE namespace.nspname = 'public'
				AND type.typname = 'workflow_status'
				AND enum_value.enumlabel IN ('in_progress', 'blocked', 'ready')
		) AS workflow_value_count,
		(
			SELECT count(*)
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND (
					(table_name = 'deliverables' AND column_name IN ('completed_at', 'tracking_mode'))
					OR (
						table_name IN ('deliverable_assignments', 'task_assignments')
						AND column_name IN (
							'progress_status',
							'progress_note',
							'started_at',
							'blocked_at',
							'updated_at'
						)
					)
				)
		) AS new_column_count,
		(
			SELECT count(*)
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND (
					(
						table_name IN ('deliverable_assignments', 'task_assignments')
						AND column_name IN ('progress_status', 'updated_at')
					)
					OR (table_name = 'deliverables' AND column_name = 'tracking_mode')
				)
				AND is_nullable = 'NO'
		) AS required_column_count,
		(
			SELECT count(*)
			FROM information_schema.tables
			WHERE table_schema = 'public'
				AND table_name = 'deliverable_task_links'
		) AS new_table_count,
		(
			SELECT count(*)
			FROM pg_indexes
			WHERE schemaname = 'public'
				AND indexname IN (
					'deliverables_org_booking_id_idx',
					'tasks_org_booking_id_idx',
					'deliverable_task_links_pair_idx',
					'deliverable_task_links_task_idx',
					'deliverable_task_links_deliverable_idx'
				)
		) AS new_index_count,
		(
			SELECT count(*)
			FROM information_schema.table_constraints
			WHERE constraint_schema = 'public'
				AND table_name = 'deliverable_task_links'
				AND constraint_name IN (
					'deliverable_task_links_organization_id_organizations_id_fk',
					'deliverable_task_links_created_by_users_id_fk',
					'deliverable_task_links_deliverable_scope_fk',
					'deliverable_task_links_task_scope_fk'
				)
		) AS new_constraint_count
), timestamp_state AS (
	SELECT
		count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivery_writes_during_cutover,
		count(*) FILTER (
			WHERE deleted_at IS NULL
				AND workflow_status = 'approved'
				AND completed_at IS NULL
		) AS active_approved_without_completion_count,
		count(*) FILTER (
			WHERE completed_at IS NOT NULL AND workflow_status <> 'approved'
		) AS unexpected_legacy_completion_count
	FROM deliverables
), assignment_state AS (
	SELECT
		(
			SELECT count(*)
			FROM task_assignments
			WHERE progress_status IS NULL OR updated_at IS NULL
		) + (
			SELECT count(*)
			FROM deliverable_assignments
			WHERE progress_status IS NULL OR updated_at IS NULL
		) AS invalid_assignment_count
), link_state AS (
	SELECT
		count(*) AS link_count,
		count(*) FILTER (
			WHERE link.id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
		) AS malformed_id_count,
		count(*) FILTER (
			WHERE deliverable.id IS NULL OR task.id IS NULL
		) AS invalid_scope_count,
		count(*) FILTER (WHERE link.kind <> 'reference') AS non_reference_link_count,
		count(*) FILTER (
			WHERE deliverable.deleted_at IS NULL AND task.deleted_at IS NOT NULL
		) AS active_link_to_deleted_task_count
	FROM deliverable_task_links AS link
	LEFT JOIN deliverables AS deliverable
		ON deliverable.id = link.deliverable_id
		AND deliverable.organization_id = link.organization_id
		AND deliverable.booking_id = link.booking_id
	LEFT JOIN tasks AS task
		ON task.id = link.task_id
		AND task.organization_id = link.organization_id
		AND task.booking_id = link.booking_id
), legacy_state AS (
	SELECT
		count(*) FILTER (WHERE link.id IS NULL) AS missing_link_count,
		count(*) FILTER (
			WHERE deliverable.deleted_at IS NULL AND task.deleted_at IS NOT NULL
		) AS active_reference_to_deleted_task_count
	FROM deliverables AS deliverable
	INNER JOIN tasks AS task
		ON task.id = nullif(btrim(deliverable.metadata ->> 'convertedToTaskId'), '')
		AND task.organization_id = deliverable.organization_id
		AND task.booking_id = deliverable.booking_id
	LEFT JOIN deliverable_task_links AS link
		ON link.deliverable_id = deliverable.id
		AND link.task_id = task.id
	WHERE nullif(btrim(deliverable.metadata ->> 'convertedToTaskId'), '') IS NOT NULL
), tracking_state AS (
	SELECT count(*) FILTER (WHERE tracking_mode <> 'direct') AS non_direct_count
	FROM deliverables
)
SELECT
	ledger.row_count AS observed_ledger_rows,
	ledger.latest_created_at AS observed_latest_migration_time,
	ledger.latest_hash AS observed_latest_hash,
	ledger.ledger_digest AS observed_ledger_digest,
	schema_state.new_type_count,
	schema_state.workflow_value_count,
	schema_state.new_column_count,
	schema_state.required_column_count,
	schema_state.new_table_count,
	schema_state.new_index_count,
	schema_state.new_constraint_count,
	timestamp_state.delivery_writes_during_cutover,
	timestamp_state.active_approved_without_completion_count,
	timestamp_state.unexpected_legacy_completion_count,
	assignment_state.invalid_assignment_count,
	link_state.link_count,
	link_state.malformed_id_count,
	link_state.invalid_scope_count,
	link_state.non_reference_link_count,
	link_state.active_link_to_deleted_task_count,
	legacy_state.missing_link_count AS missing_legacy_link_count,
	legacy_state.active_reference_to_deleted_task_count,
	tracking_state.non_direct_count AS non_direct_tracking_count,
	ledger.row_count = 50
		AND ledger.latest_created_at = 1784752206666
		AND ledger.latest_hash = '9f8143074b242b48b5cf4c0034e2d13b8359cc911e416ef278b50c7bda4f7ffe'
		AND ledger.ledger_digest = '6b988d4bb573534343a4cf3c5041ac47'
		AND schema_state.new_type_count = 3
		AND schema_state.workflow_value_count = 3
		AND schema_state.new_column_count = 12
		AND schema_state.required_column_count = 5
		AND schema_state.new_table_count = 1
		AND schema_state.new_index_count = 5
		AND schema_state.new_constraint_count = 4
		AND timestamp_state.delivery_writes_during_cutover = 0
		AND timestamp_state.active_approved_without_completion_count = 0
		AND timestamp_state.unexpected_legacy_completion_count = 0
		AND assignment_state.invalid_assignment_count = 0
		AND link_state.malformed_id_count = 0
		AND link_state.invalid_scope_count = 0
		AND link_state.non_reference_link_count = 0
		AND link_state.active_link_to_deleted_task_count = 0
		AND legacy_state.missing_link_count = 0
		AND legacy_state.active_reference_to_deleted_task_count = 0
		AND tracking_state.non_direct_count = 0
		AS task_driven_deliverables_cutover_ok
FROM ledger
CROSS JOIN schema_state
CROSS JOIN timestamp_state
CROSS JOIN assignment_state
CROSS JOIN link_state
CROSS JOIN legacy_state
CROSS JOIN tracking_state
\gset

\echo 'Task-driven deliverables cutover diagnostics:'
\echo '  ledger rows:' :observed_ledger_rows
\echo '  latest migration time:' :observed_latest_migration_time
\echo '  latest hash:' :observed_latest_hash
\echo '  ledger digest:' :observed_ledger_digest
\echo '  types/workflow values/columns/required columns/tables/indexes/constraints:' :new_type_count/:workflow_value_count/:new_column_count/:required_column_count/:new_table_count/:new_index_count/:new_constraint_count
\echo '  delivery writes during cutover:' :delivery_writes_during_cutover
\echo '  active approved deliverables without completion:' :active_approved_without_completion_count
\echo '  unexpected legacy completion rows:' :unexpected_legacy_completion_count
\echo '  invalid assignment rows:' :invalid_assignment_count
\echo '  links/malformed IDs/invalid scopes/non-reference links:' :link_count/:malformed_id_count/:invalid_scope_count/:non_reference_link_count
\echo '  active deliverable links to deleted tasks:' :active_link_to_deleted_task_count
\echo '  missing legacy links:' :missing_legacy_link_count
\echo '  active references to deleted tasks:' :active_reference_to_deleted_task_count
\echo '  non-direct tracking rows:' :non_direct_tracking_count

\if :task_driven_deliverables_cutover_ok
	\echo 'Task-driven deliverables cutover verification passed: exact 0049 ledger, complete schema, reviewed stale conversions repaired, and no mutation-window drift.'
\else
	\echo 'Task-driven deliverables cutover verification failed. Keep task/deliverable mutations frozen and investigate.'
	SELECT 1 / 0 AS task_driven_deliverables_cutover_abort;
\endif

COMMIT;
