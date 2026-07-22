\set ON_ERROR_STOP on

BEGIN READ ONLY;

WITH ledger AS (
	SELECT
		count(*) AS row_count,
		coalesce(max(created_at), 0) AS latest_created_at,
		coalesce((array_agg(hash ORDER BY created_at DESC))[1], '') AS latest_hash,
		coalesce(md5(string_agg(hash, ',' ORDER BY created_at)), '') AS ledger_digest
	FROM drizzle.__drizzle_migrations
), partial_schema AS (
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
		) AS new_index_count
), timestamp_state AS (
	SELECT
		count(*) FILTER (
			WHERE delivered_at IS NOT NULL AND workflow_status <> 'approved'
		) AS non_approved_delivery_count,
		count(*) FILTER (
			WHERE deleted_at IS NULL
				AND workflow_status = 'approved'
				AND delivered_at IS NULL
		) AS active_approved_without_timestamp_count,
		count(*) FILTER (WHERE delivered_at IS NOT NULL) AS timestamps_to_move
	FROM deliverables
), legacy_references AS (
	SELECT
		d.id AS deliverable_id,
		d.deleted_at AS deliverable_deleted_at,
		d.workflow_status AS deliverable_workflow_status,
		nullif(btrim(d.metadata ->> 'convertedToTaskId'), '') AS task_id,
		t.id AS resolved_task_id,
		t.deleted_at AS task_deleted_at,
		t.workflow_status AS task_workflow_status,
		t.metadata ->> 'convertedFromDeliverableId' = d.id
			AS has_reciprocal_metadata,
		NOT EXISTS (
			SELECT 1
			FROM deliverable_assignments AS assignment
			WHERE assignment.deliverable_id = d.id
		) AS has_no_deliverable_assignments,
		NOT EXISTS (
			SELECT 1
			FROM assignment_submissions AS submission
			WHERE submission.deliverable_id = d.id
		) AS has_no_deliverable_submissions,
		NOT EXISTS (
			SELECT 1
			FROM task_assignments AS assignment
			WHERE assignment.task_id = t.id
		) AS has_no_task_assignments,
		NOT EXISTS (
			SELECT 1
			FROM assignment_submissions AS submission
			WHERE submission.task_id = t.id
		) AS has_no_task_submissions
	FROM deliverables AS d
	LEFT JOIN tasks AS t
		ON t.id = nullif(btrim(d.metadata ->> 'convertedToTaskId'), '')
		AND t.organization_id = d.organization_id
		AND t.booking_id = d.booking_id
	WHERE nullif(btrim(d.metadata ->> 'convertedToTaskId'), '') IS NOT NULL
), legacy_state AS (
	SELECT
		count(*) AS reference_count,
		count(*) FILTER (
			WHERE deliverable_deleted_at IS NULL AND resolved_task_id IS NULL
		) AS unresolved_active_reference_count,
		count(*) FILTER (
			WHERE deliverable_deleted_at IS NULL
				AND task_deleted_at IS NOT NULL
				AND deliverable_workflow_status = 'not_started'
				AND task_workflow_status = 'not_started'
				AND has_reciprocal_metadata IS TRUE
				AND has_no_deliverable_assignments
				AND has_no_deliverable_submissions
				AND has_no_task_assignments
				AND has_no_task_submissions
		) AS repairable_deleted_task_reference_count,
		count(*) FILTER (
			WHERE deliverable_deleted_at IS NULL
				AND task_deleted_at IS NOT NULL
				AND NOT (
					deliverable_workflow_status = 'not_started'
					AND task_workflow_status = 'not_started'
					AND has_reciprocal_metadata IS TRUE
					AND has_no_deliverable_assignments
					AND has_no_deliverable_submissions
					AND has_no_task_assignments
					AND has_no_task_submissions
				)
		) AS unsafe_deleted_task_reference_count
	FROM legacy_references
)
SELECT
	ledger.row_count AS observed_ledger_rows,
	ledger.latest_created_at AS observed_latest_migration_time,
	ledger.latest_hash AS observed_latest_hash,
	ledger.ledger_digest AS observed_ledger_digest,
	partial_schema.new_type_count AS partial_new_types,
	partial_schema.workflow_value_count AS partial_workflow_values,
	partial_schema.new_column_count AS partial_new_columns,
	partial_schema.new_table_count AS partial_new_tables,
	partial_schema.new_index_count AS partial_new_indexes,
	timestamp_state.non_approved_delivery_count,
	timestamp_state.active_approved_without_timestamp_count,
	timestamp_state.timestamps_to_move,
	legacy_state.reference_count AS legacy_reference_count,
	legacy_state.unresolved_active_reference_count,
	legacy_state.repairable_deleted_task_reference_count,
	legacy_state.unsafe_deleted_task_reference_count,
	ledger.row_count = 46
		AND ledger.latest_created_at = 1784550431955
		AND ledger.latest_hash = 'ce5f921d6ca7f0aa29fe627853fa15075261fb2ba0f1ec0760eff68b8945c166'
		AND ledger.ledger_digest = '6008232e9e0eeb05362ead618f145128'
		AND partial_schema.new_type_count = 0
		AND partial_schema.workflow_value_count = 0
		AND partial_schema.new_column_count = 0
		AND partial_schema.new_table_count = 0
		AND partial_schema.new_index_count = 0
		AND timestamp_state.non_approved_delivery_count = 0
		AND timestamp_state.active_approved_without_timestamp_count = 0
		AND legacy_state.unresolved_active_reference_count = 0
		AND legacy_state.repairable_deleted_task_reference_count = 2
		AND legacy_state.unsafe_deleted_task_reference_count = 0
		AS task_driven_deliverables_preflight_ok
FROM ledger
CROSS JOIN partial_schema
CROSS JOIN timestamp_state
CROSS JOIN legacy_state
\gset

\echo 'Task-driven deliverables preflight diagnostics:'
\echo '  ledger rows:' :observed_ledger_rows
\echo '  latest migration time:' :observed_latest_migration_time
\echo '  latest hash:' :observed_latest_hash
\echo '  ledger digest:' :observed_ledger_digest
\echo '  partial types/workflow values/columns/tables/indexes:' :partial_new_types/:partial_workflow_values/:partial_new_columns/:partial_new_tables/:partial_new_indexes
\echo '  non-approved legacy delivery timestamps:' :non_approved_delivery_count
\echo '  active approved deliverables without completion timestamp:' :active_approved_without_timestamp_count
\echo '  legacy timestamps to move:' :timestamps_to_move
\echo '  legacy conversion references:' :legacy_reference_count
\echo '  unresolved active references:' :unresolved_active_reference_count
\echo '  approved repairable references to deleted tasks:' :repairable_deleted_task_reference_count
\echo '  unsafe references to deleted tasks:' :unsafe_deleted_task_reference_count

\if :task_driven_deliverables_preflight_ok
	\echo 'Task-driven deliverables preflight passed: exact 0045 ledger, no partial 0046-0049 schema, and exactly two reviewed stale conversions are repairable.'
\else
	\echo 'Task-driven deliverables preflight failed. Stop before migration and investigate the diagnostic counts.'
	SELECT 1 / 0 AS task_driven_deliverables_preflight_abort;
\endif

COMMIT;
