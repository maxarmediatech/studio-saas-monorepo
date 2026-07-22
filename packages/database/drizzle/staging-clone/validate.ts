import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { Client } from "pg";
import {
	CLEARED_AUTH_TABLES,
	ROW_COUNT_MUTABLE_AUTH_TABLES,
} from "./sanitizers/auth";
import type { SchemaContract } from "./schema-contract";
import {
	assertCriticalSchemaStructures,
	assertSchemaMatchesContract,
	fingerprintSchema,
	readApplicationSchema,
	readTableCounts,
} from "./schema-contract";
import {
	SNAPSHOT_MANIFEST_VERSION,
	type SnapshotManifest,
	type TableCounts,
} from "./types";

type ValidationCheck = {
	name: string;
	query: string;
};

const checks: ValidationCheck[] = [
	{
		name: "invalid staging administrator or invitation emails",
		query: `SELECT CASE WHEN
			(SELECT count(*) FROM users WHERE email NOT LIKE '%@example.invalid') = 1
			AND (SELECT count(*) FROM users WHERE email NOT LIKE '%@example.invalid' AND name = 'Staging Admin') = 1
			AND (SELECT count(*) FROM invitations WHERE email NOT LIKE '%@example.invalid') = 0
		THEN 0 ELSE 1 END::bigint AS count`,
	},
	{
		name: "real client, crew, WhatsApp, or calendar emails",
		query: `SELECT
			(SELECT count(*) FROM clients WHERE email IS NOT NULL AND email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM crews WHERE email IS NOT NULL AND email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM wa_contacts WHERE email IS NOT NULL AND email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM google_calendar_connections WHERE google_account_email IS NOT NULL AND google_account_email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM shoot_calendar_events WHERE recipient_email IS NOT NULL AND recipient_email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM shoot_calendar_events WHERE delivered_recipient_email IS NOT NULL AND delivered_recipient_email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM calendar_delivery_intents WHERE recipient_email IS NOT NULL AND recipient_email NOT LIKE '%@example.invalid') +
			(SELECT count(*) FROM calendar_delivery_intents WHERE google_account_email IS NOT NULL AND google_account_email NOT LIKE '%@example.invalid') AS count`,
	},
	{
		name: "authentication or provider secrets",
		query: `SELECT
			(SELECT count(*) FROM accounts account
			 JOIN users ON users.id = account.user_id
			 WHERE account.access_token IS NOT NULL
			 OR account.refresh_token IS NOT NULL
			 OR account.id_token IS NOT NULL
			 OR (account.password IS NOT NULL AND NOT (
				account.provider_id = 'credential'
				AND account.account_id = account.user_id
				AND users.name = 'Staging Admin'
				AND users.email NOT LIKE '%@example.invalid'
			 ))) +
			(SELECT count(*) FROM google_calendar_connections WHERE access_token IS NOT NULL OR refresh_token IS NOT NULL) +
			(SELECT count(*) FROM wa_accounts WHERE access_token IS NOT NULL OR app_secret IS NOT NULL OR session_key IS NOT NULL OR session_data IS NOT NULL OR webhook_verify_token IS NOT NULL OR qr_code IS NOT NULL) +
			CASE WHEN (SELECT count(*) FROM accounts WHERE password IS NOT NULL AND provider_id = 'credential') = 1 THEN 0 ELSE 1 END AS count`,
	},
	{
		name: "unsanitized phone numbers",
		query: `SELECT
			(SELECT count(*) FROM clients WHERE phone_number IS NOT NULL AND phone_number NOT LIKE '+1999%') +
			(SELECT count(*) FROM clients WHERE alternate_phone IS NOT NULL AND alternate_phone NOT LIKE '+1999%') +
			(SELECT count(*) FROM crews WHERE phone_number IS NOT NULL AND phone_number NOT LIKE '+1999%') +
			(SELECT count(*) FROM wa_accounts WHERE phone_number IS NOT NULL AND phone_number NOT LIKE '+1999%') +
			(SELECT count(*) FROM wa_contacts WHERE wa_id NOT LIKE '+1999%' OR (phone_number IS NOT NULL AND phone_number NOT LIKE '+1999%')) +
			(SELECT count(*) FROM sms_outbox WHERE phone_number NOT LIKE '+1999%') AS count`,
	},
	{
		name: "runnable outbound work",
		query: `SELECT
			(SELECT count(*) FROM wa_outbox WHERE status IN ('pending', 'processing') OR (status = 'failed' AND COALESCE(attempts, 0) < COALESCE(max_attempts, 3))) +
			(SELECT count(*) FROM wa_events WHERE processed_at IS NULL AND processing_status IN ('pending', 'processing', 'failed') AND attempts < max_attempts) +
			(SELECT count(*) FROM wa_media WHERE ingest_status IN ('pending', 'processing')) +
			(SELECT count(*) FROM wa_automation_runs WHERE status IN ('pending', 'processing') OR (status IN ('failed', 'waiting') AND next_attempt_at IS NOT NULL)) +
			(SELECT count(*) FROM wa_automation_actions WHERE status IN ('pending', 'processing', 'waiting') OR (status = 'failed' AND attempts < max_attempts)) +
			(SELECT count(*) FROM wa_campaign_recipients WHERE status IN ('pending', 'queued')) +
			(SELECT count(*) FROM sms_outbox WHERE status IN ('pending', 'processing')) +
			(SELECT count(*) FROM calendar_sync_jobs WHERE status IN ('pending', 'processing') OR (status = 'failed' AND (effect_state = 'provider_applied' OR effect_state IN ('pending', 'compensating')))) +
			(SELECT count(*) FROM calendar_route_changes WHERE status = 'pending') +
			(SELECT count(*) FROM wa_campaigns WHERE status IN ('scheduled', 'running', 'paused')) +
			(SELECT count(*) FROM wa_accounts WHERE connection_status <> 'disconnected') AS count`,
	},
	{
		name: "unsanitized integration payloads",
		query: `SELECT
			(SELECT count(*) FROM calendar_delivery_intents WHERE payload <> '{}'::jsonb) +
			(SELECT count(*) FROM calendar_sync_jobs WHERE payload IS NOT NULL AND payload <> '{}'::jsonb) +
			(SELECT count(*) FROM calendar_sync_jobs WHERE provider_result IS NOT NULL AND provider_result <> '{}'::jsonb) +
			(SELECT count(*) FROM wa_events WHERE payload <> '{}'::jsonb) +
			(SELECT count(*) FROM wa_automation_runs WHERE action_snapshot <> '{}'::jsonb) +
			(SELECT count(*) FROM wa_automation_actions WHERE payload <> '{}'::jsonb) +
			(SELECT count(*) FROM wa_templates WHERE components IS NOT NULL AND components <> '[]'::jsonb) +
			(SELECT count(*) FROM payment_idempotency_records WHERE result_payload IS NOT NULL AND result_payload <> '{}'::jsonb) AS count`,
	},
	{
		name: "unsanitized provider metadata or operational errors",
		query: `SELECT
			(SELECT count(*) FROM document_sequences WHERE scope_key !~ '^[0-9a-f]{32}$') +
			(SELECT count(*) FROM wa_accounts WHERE verified_name IS NOT NULL AND verified_name NOT LIKE 'Verified business %') +
			(SELECT count(*) FROM wa_outbox WHERE dispatch_token IS NOT NULL OR dispatch_started_at IS NOT NULL OR locked_by IS NOT NULL OR lease_expires_at IS NOT NULL) +
			(SELECT count(*) FROM calendar_sync_jobs WHERE claim_token IS NOT NULL OR locked_at IS NOT NULL) +
			(SELECT count(*) FROM wa_media WHERE ingest_error_message IS NOT NULL AND ingest_error_message NOT IN ('Disabled in sanitized staging snapshot', 'Sanitized media ingestion failure')) +
			(SELECT count(*) FROM wa_campaign_recipients WHERE suppression_reason IS NOT NULL AND suppression_reason NOT IN ('Disabled in sanitized staging snapshot', 'Sanitized suppression reason')) +
			(SELECT count(*) FROM wa_outbox WHERE error_message IS NOT NULL AND error_message NOT IN ('Disabled in sanitized staging snapshot', 'Sanitized delivery failure')) +
			(SELECT count(*) FROM calendar_sync_jobs WHERE last_error IS NOT NULL AND last_error NOT IN ('Disabled in sanitized staging snapshot', 'Sanitized calendar delivery failure')) AS count`,
	},
	{
		name: "live file or link URLs",
		query: `SELECT
			(SELECT count(*) FROM attachments WHERE file_url NOT LIKE 'https://example.invalid/%') +
			(SELECT count(*) FROM submission_files WHERE file_url NOT LIKE 'https://example.invalid/%') +
			(SELECT count(*) FROM quick_links WHERE url NOT LIKE 'https://example.invalid/%') +
			(SELECT count(*) FROM wa_media WHERE storage_url IS NOT NULL AND storage_url NOT LIKE 'https://example.invalid/%') +
			(SELECT count(*) FROM wa_media WHERE thumbnail_url IS NOT NULL AND thumbnail_url NOT LIKE 'https://example.invalid/%') AS count`,
	},
	{
		name: "unsanitized assignment progress notes",
		query: `SELECT
			(SELECT count(*) FROM task_assignments WHERE progress_note IS NOT NULL AND progress_note <> 'Sanitized assignment progress note') +
			(SELECT count(*) FROM deliverable_assignments WHERE progress_note IS NOT NULL AND progress_note <> 'Sanitized assignment progress note') AS count`,
	},
];

function assertRowCounts(before: TableCounts, after: TableCounts): void {
	const mutableAuth = new Set<string>(ROW_COUNT_MUTABLE_AUTH_TABLES);
	const mismatches = Object.keys(before).filter(
		(tableName) =>
			!mutableAuth.has(tableName) &&
			before[tableName] !== after[tableName],
	);
	const unclearedAuth = [...CLEARED_AUTH_TABLES].filter(
		(tableName) => after[tableName] !== "0",
	);
	const accountsBefore = BigInt(before.accounts ?? "0");
	const accountsAfter = BigInt(after.accounts ?? "0");
	const invalidAccountDelta =
		accountsAfter !== accountsBefore &&
		accountsAfter !== accountsBefore + 1n;
	if (
		mismatches.length > 0 ||
		unclearedAuth.length > 0 ||
		invalidAccountDelta
	) {
		throw new Error(
			`Sanitization changed unexpected row counts. Mismatched: ${mismatches.join(", ") || "none"}; uncleared auth tables: ${unclearedAuth.join(", ") || "none"}; accounts delta: ${accountsAfter - accountsBefore}`,
		);
	}
}

export async function validateSanitizedDatabase(
	client: Client,
	contract: SchemaContract,
	beforeSchemaFingerprint: string,
	tableCountsBefore: TableCounts,
): Promise<{
	sanitizedSchemaFingerprint: string;
	tableCountsAfter: TableCounts;
}> {
	const schema = await readApplicationSchema(client);
	assertSchemaMatchesContract(contract, schema);
	await assertCriticalSchemaStructures(client);
	const sanitizedSchemaFingerprint = await fingerprintSchema(client, schema);
	if (sanitizedSchemaFingerprint !== beforeSchemaFingerprint) {
		throw new Error(
			"Sanitization unexpectedly changed the database schema",
		);
	}

	const tableCountsAfter = await readTableCounts(client, contract);
	assertRowCounts(tableCountsBefore, tableCountsAfter);

	for (const check of checks) {
		const result = await client.query<{ count: string }>(check.query);
		if (result.rows[0]?.count !== "0") {
			throw new Error(`Sanitization validation failed: ${check.name}`);
		}
	}

	return { sanitizedSchemaFingerprint, tableCountsAfter };
}

export async function sha256File(filePath: string): Promise<string> {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(filePath)) {
		hash.update(chunk);
	}
	return hash.digest("hex");
}

export function parseManifest(value: unknown): SnapshotManifest {
	if (!value || typeof value !== "object") {
		throw new Error("Sanitized snapshot manifest is invalid");
	}
	const manifest = value as Partial<SnapshotManifest>;
	if (
		manifest.version !== SNAPSHOT_MANIFEST_VERSION ||
		typeof manifest.createdAt !== "string" ||
		typeof manifest.schemaSnapshotTag !== "string" ||
		typeof manifest.archiveSha256 !== "string" ||
		typeof manifest.sourceSchemaFingerprint !== "string" ||
		typeof manifest.sanitizedSchemaFingerprint !== "string" ||
		!manifest.tableCountsBefore ||
		!manifest.tableCountsAfter ||
		!Array.isArray(manifest.clearedTables) ||
		manifest.sourceSchemaFingerprint !==
			manifest.sanitizedSchemaFingerprint ||
		manifest.validation?.schemaPreserved !== true ||
		manifest.validation?.businessRowCountsPreserved !== true ||
		manifest.validation?.secretsRemoved !== true ||
		manifest.validation?.outboundWorkDisabled !== true
	) {
		throw new Error("Sanitized snapshot manifest did not pass validation");
	}
	return manifest as SnapshotManifest;
}
