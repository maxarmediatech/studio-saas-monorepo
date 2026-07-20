import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Client } from "pg";
import type { TableCounts } from "./types";
import { SANITIZER_REVIEWED_SNAPSHOT_TAG } from "./types";

type SchemaColumn = {
	tableName: string;
	columnName: string;
	dataType: string;
	notNull: boolean;
};

type Journal = {
	entries: Array<{ idx: number; tag: string }>;
};

type Snapshot = {
	tables: Record<
		string,
		{
			columns: Record<string, { type: string; notNull: boolean }>;
		}
	>;
};

export type SchemaContract = {
	snapshotTag: string;
	tables: Record<string, Record<string, { type: string; notNull: boolean }>>;
};

const REQUIRED_INDEXES = [
	"document_sequences_org_type_scope_idx",
	"payment_idempotency_org_operation_key_idx",
	"invoices_active_payment_schedule_idx",
	"receipts_active_received_amount_idx",
	"calendar_delivery_intents_org_target_generation_idx",
	"calendar_sync_jobs_active_delivery_key_idx",
	"google_calendar_connections_active_org_user_idx",
	"shoot_calendar_events_org_shoot_crew_idx",
	"wa_automation_actions_run_index_idx",
	"wa_automation_runs_trigger_identity_idx",
	"wa_campaign_recipients_identity_idx",
	"wa_manual_send_idempotency_scope_key_idx",
	"wa_templates_account_name_language_uidx",
	"wa_contacts_account_wa_id_idx",
	"wa_messages_account_provider_message_id_idx",
	"wa_outbox_message_id_idx",
] as const;

const REQUIRED_TRIGGERS = [
	"payment_schedules_financial_relationship_guard",
	"invoices_financial_relationship_guard",
	"received_amounts_financial_relationship_guard",
	"receipts_financial_relationship_guard",
	"received_amounts_relationship_closure_guard",
	"invoices_payment_relationship_closure_guard",
	"wa_events_preserve_retryable_failures_trigger",
] as const;

const REQUIRED_ENUM_VALUES: Record<string, readonly string[]> = {
	calendar_delivery_method: ["unsendable"],
	calendar_event_sync_status: ["unsendable"],
	wa_automation_action_status: [
		"pending",
		"processing",
		"waiting",
		"completed",
		"failed",
	],
	wa_automation_run_status: [
		"pending",
		"processing",
		"waiting",
		"completed",
		"failed",
	],
	wa_campaign_recipient_status: ["suppressed", "delivery_unknown"],
	wa_media_ingest_status: ["pending", "processing", "ready", "failed"],
	wa_message_status: ["suppressed", "delivery_unknown"],
	wa_outbox_status: ["suppressed", "delivery_unknown"],
};

const REQUIRED_DEFAULTS: Record<string, string> = {
	"two_factors.verified": "true",
	"two_factors.failed_verification_count": "0",
	"wa_events.processing_status": "'pending'::text",
	"wa_events.next_attempt_at": "now()",
	"wa_media.ingest_status": "'ready'::wa_media_ingest_status",
	"calendar_sync_jobs.effect_state": "'pending'::text",
};

const migrationsDirectory = fileURLToPath(
	new URL("../migrations", import.meta.url),
);

function quoteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}

export async function loadSchemaContract(): Promise<SchemaContract> {
	const journal = JSON.parse(
		await readFile(`${migrationsDirectory}/meta/_journal.json`, "utf8"),
	) as Journal;
	const availableFiles = new Set(
		await readdir(`${migrationsDirectory}/meta`),
	);
	const entry = [...journal.entries]
		.reverse()
		.find(({ idx }) =>
			availableFiles.has(`${String(idx).padStart(4, "0")}_snapshot.json`),
		);
	if (!entry) {
		throw new Error("No Drizzle schema snapshot is available");
	}
	if (entry.tag !== SANITIZER_REVIEWED_SNAPSHOT_TAG) {
		throw new Error(
			`The sanitizer was reviewed for ${SANITIZER_REVIEWED_SNAPSHOT_TAG}, but this branch uses ${entry.tag}. Review every new or changed field, update sanitizers and validation, then bump SANITIZER_REVIEWED_SNAPSHOT_TAG.`,
		);
	}

	const snapshotName = `${String(entry.idx).padStart(4, "0")}_snapshot.json`;
	const snapshot = JSON.parse(
		await readFile(`${migrationsDirectory}/meta/${snapshotName}`, "utf8"),
	) as Snapshot;
	const entries: Array<
		[string, Record<string, { type: string; notNull: boolean }>]
	> = Object.entries(snapshot.tables)
		.filter(([name]) => name.startsWith("public."))
		.map(([name, table]) => [
			name.slice("public.".length),
			Object.fromEntries(
				Object.entries(table.columns)
					.map(
						([columnName, column]): [
							string,
							{ type: string; notNull: boolean },
						] => [
							columnName,
							{ type: column.type, notNull: column.notNull },
						],
					)
					.sort(([left], [right]) => left.localeCompare(right)),
			),
		]);
	entries.sort(([left], [right]) => left.localeCompare(right));
	const tables = Object.fromEntries(entries);
	return { snapshotTag: entry.tag, tables };
}

export async function readApplicationSchema(
	client: Client,
): Promise<SchemaColumn[]> {
	const result = await client.query<SchemaColumn>(`
		SELECT
			class.relname AS "tableName",
			attribute.attname AS "columnName",
			pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) AS "dataType",
			attribute.attnotnull AS "notNull"
		FROM pg_catalog.pg_class class
		JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
		JOIN pg_catalog.pg_attribute attribute ON attribute.attrelid = class.oid
		WHERE namespace.nspname = 'public'
			AND class.relkind IN ('r', 'p')
			AND attribute.attnum > 0
			AND NOT attribute.attisdropped
		ORDER BY class.relname, attribute.attnum
	`);
	return result.rows;
}

function normalizeType(value: string): string {
	return value
		.replace(/^character varying/, "varchar")
		.replace(/^timestamp without time zone$/, "timestamp")
		.replace(/^time without time zone$/, "time")
		.replaceAll('"', "")
		.replaceAll(/\s+/g, "");
}

export async function fingerprintSchema(
	client: Client,
	columns: SchemaColumn[],
): Promise<string> {
	const [constraints, indexes, enums, sequences] = await Promise.all([
		client.query(`
			SELECT class.relname AS table_name, constraint_record.conname AS name,
				constraint_record.contype AS type,
				pg_get_constraintdef(constraint_record.oid, true) AS definition
			FROM pg_constraint constraint_record
			JOIN pg_class class ON class.oid = constraint_record.conrelid
			JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public'
			ORDER BY class.relname, constraint_record.conname
		`),
		client.query(`
			SELECT tablename, indexname, indexdef
			FROM pg_indexes
			WHERE schemaname = 'public'
			ORDER BY tablename, indexname
		`),
		client.query(`
			SELECT type_record.typname AS name, enum_record.enumsortorder AS sort_order,
				enum_record.enumlabel AS label
			FROM pg_type type_record
			JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
			JOIN pg_namespace namespace ON namespace.oid = type_record.typnamespace
			WHERE namespace.nspname = 'public'
			ORDER BY type_record.typname, enum_record.enumsortorder
		`),
		client.query(`
			SELECT class.relname AS name
			FROM pg_class class
			JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public' AND class.relkind = 'S'
			ORDER BY class.relname
		`),
	]);
	return createHash("sha256")
		.update(
			JSON.stringify({
				columns,
				constraints: constraints.rows,
				indexes: indexes.rows,
				enums: enums.rows,
				sequences: sequences.rows,
			}),
		)
		.digest("hex");
}

export async function assertCriticalSchemaStructures(
	client: Client,
): Promise<void> {
	const [indexes, triggers, enums, defaults] = await Promise.all([
		client.query<{ name: string }>(`
			SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'
		`),
		client.query<{ name: string }>(`
			SELECT DISTINCT trigger_name AS name
			FROM information_schema.triggers
			WHERE trigger_schema = 'public'
		`),
		client.query<{ name: string; value: string }>(`
			SELECT type_record.typname AS name, enum_record.enumlabel AS value
			FROM pg_type type_record
			JOIN pg_enum enum_record ON enum_record.enumtypid = type_record.oid
			JOIN pg_namespace namespace ON namespace.oid = type_record.typnamespace
			WHERE namespace.nspname = 'public'
		`),
		client.query<{
			tableName: string;
			columnName: string;
			defaultValue: string | null;
		}>(`
			SELECT table_name AS "tableName", column_name AS "columnName",
				column_default AS "defaultValue"
			FROM information_schema.columns
			WHERE table_schema = 'public'
		`),
	]);

	const indexNames = new Set(indexes.rows.map(({ name }) => name));
	const triggerNames = new Set(triggers.rows.map(({ name }) => name));
	const enumValues = new Map<string, Set<string>>();
	for (const { name, value } of enums.rows) {
		const values = enumValues.get(name) ?? new Set<string>();
		values.add(value);
		enumValues.set(name, values);
	}
	const defaultValues = new Map(
		defaults.rows.map(({ tableName, columnName, defaultValue }) => [
			`${tableName}.${columnName}`,
			defaultValue,
		]),
	);

	const missingIndexes = REQUIRED_INDEXES.filter(
		(name) => !indexNames.has(name),
	);
	const missingTriggers = REQUIRED_TRIGGERS.filter(
		(name) => !triggerNames.has(name),
	);
	const missingEnumValues = Object.entries(REQUIRED_ENUM_VALUES).flatMap(
		([name, expected]) =>
			expected
				.filter((value) => !enumValues.get(name)?.has(value))
				.map((value) => `${name}.${value}`),
	);
	const mismatchedDefaults = Object.entries(REQUIRED_DEFAULTS)
		.filter(([name, expected]) => defaultValues.get(name) !== expected)
		.map(([name]) => name);

	if (
		missingIndexes.length > 0 ||
		missingTriggers.length > 0 ||
		missingEnumValues.length > 0 ||
		mismatchedDefaults.length > 0
	) {
		throw new Error(
			[
				"Database is missing critical structures required through migration 0045.",
				`Indexes: ${missingIndexes.join(", ") || "none"}.`,
				`Triggers: ${missingTriggers.join(", ") || "none"}.`,
				`Enum values: ${missingEnumValues.join(", ") || "none"}.`,
				`Defaults: ${mismatchedDefaults.join(", ") || "none"}.`,
			].join(" "),
		);
	}
}

export function assertSchemaMatchesContract(
	contract: SchemaContract,
	columns: SchemaColumn[],
): void {
	const actualTables = new Map<string, string[]>();
	for (const column of columns) {
		const tableColumns = actualTables.get(column.tableName) ?? [];
		tableColumns.push(column.columnName);
		actualTables.set(column.tableName, tableColumns);
	}

	const expectedNames = Object.keys(contract.tables).sort();
	const actualNames = [...actualTables.keys()].sort();
	const missingTables = expectedNames.filter(
		(name) => !actualTables.has(name),
	);
	const extraTables = actualNames.filter(
		(name) => !(name in contract.tables),
	);
	const columnMismatches: string[] = [];

	for (const tableName of expectedNames) {
		const expected = contract.tables[tableName];
		const actual = actualTables.get(tableName);
		if (!expected || !actual) {
			continue;
		}
		const expectedNamesForTable = Object.keys(expected);
		const missing = expectedNamesForTable.filter(
			(name) => !actual.includes(name),
		);
		const extra = actual.filter((name) => !(name in expected));
		const definitions = columns
			.filter((column) => column.tableName === tableName)
			.filter((column) => {
				const expectedColumn = expected[column.columnName];
				return (
					expectedColumn &&
					(normalizeType(column.dataType) !==
						normalizeType(expectedColumn.type) ||
						column.notNull !== expectedColumn.notNull)
				);
			})
			.map((column) => column.columnName);
		if (missing.length > 0 || extra.length > 0 || definitions.length > 0) {
			columnMismatches.push(
				`${tableName} (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}; type/nullability: ${definitions.join(", ") || "none"})`,
			);
		}
	}

	if (
		missingTables.length > 0 ||
		extraTables.length > 0 ||
		columnMismatches.length > 0
	) {
		throw new Error(
			[
				`Database schema does not match ${contract.snapshotTag}.`,
				`Missing tables: ${missingTables.join(", ") || "none"}.`,
				`Extra tables: ${extraTables.join(", ") || "none"}.`,
				`Column mismatches: ${columnMismatches.join("; ") || "none"}.`,
			].join(" "),
		);
	}
}

export async function readTableCounts(
	client: Client,
	contract: SchemaContract,
): Promise<TableCounts> {
	const counts: TableCounts = {};
	for (const tableName of Object.keys(contract.tables).sort()) {
		const result = await client.query<{ count: string }>(
			`SELECT count(*)::text AS count FROM ${quoteIdentifier(tableName)}`,
		);
		counts[tableName] = result.rows[0]?.count ?? "0";
	}
	return counts;
}
