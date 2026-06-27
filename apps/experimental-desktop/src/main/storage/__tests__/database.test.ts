import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { openConversationDatabase } from "../database";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("conversation database migrations", () => {
	it("backfills already promoted drafts when adding target columns", () => {
		const path = tempDbPath();
		const db = new Database(path);
		db.exec(`
CREATE TABLE schema_migrations (
	id TEXT PRIMARY KEY,
	applied_at TEXT NOT NULL
);
INSERT INTO schema_migrations (id, applied_at) VALUES
	('0001_conversation_layer', '2026-06-25T00:00:00.000Z'),
	('0002_conversation_tree', '2026-06-25T00:00:00.000Z'),
	('0003_conversation_summaries', '2026-06-25T00:00:00.000Z'),
	('0004_compaction_boundaries', '2026-06-25T00:00:00.000Z'),
	('0005_draft_payload', '2026-06-25T00:00:00.000Z'),
	('0006_admitted_requests_queue', '2026-06-25T00:00:00.000Z');
CREATE TABLE conversations (id TEXT PRIMARY KEY);
CREATE TABLE drafts (
	id TEXT PRIMARY KEY,
	text TEXT NOT NULL DEFAULT '',
	cwd TEXT,
	model TEXT,
	runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('read-only', 'workspace-write', 'full-access')),
	attachments_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	promoted_conversation_id TEXT,
	payload_json TEXT NOT NULL DEFAULT '{}'
);
INSERT INTO drafts
	(id, text, runtime_mode, attachments_json, created_at, updated_at, promoted_conversation_id, payload_json)
VALUES
	('draft-active', '', 'read-only', '[]', '2026-06-25T00:00:00.000Z', '2026-06-25T00:00:00.000Z', NULL, '{}'),
	('draft-attachment', 'old attachment', 'workspace-write', '[{"id":"file-1","kind":"file","name":"notes.md","path":"/tmp/notes.md","mimeType":"text/markdown","status":"ready"}]', '2026-06-25T00:00:00.000Z', '2026-06-25T00:00:00.000Z', NULL, '{"mode":"build"}'),
	('draft-malformed-payload', 'bad payload', 'read-only', '[]', '2026-06-25T00:00:00.000Z', '2026-06-25T00:00:00.000Z', NULL, '{bad-json'),
	('draft-promoted', '', 'read-only', '[]', '2026-06-25T00:00:00.000Z', '2026-06-25T00:00:00.000Z', 'conversation-1', '{}');
`);
		db.close();

		const migrated = openConversationDatabase(path);
		const rows = migrated
			.prepare(
				"SELECT id, status, version, mode, attachments_json AS attachmentsJson, payload_json AS payloadJson FROM drafts ORDER BY id",
			)
			.all() as Array<{
			id: string;
			status: string;
			version: number;
			mode: string;
			attachmentsJson: string;
			payloadJson: string;
		}>;
		migrated.close();

		expect(rows).toEqual([
			{
				id: "draft-active",
				status: "active",
				version: 1,
				mode: "ask",
				attachmentsJson: "[]",
				payloadJson: "{}",
			},
			{
				id: "draft-attachment",
				status: "active",
				version: 1,
				mode: "ask",
				attachmentsJson:
					'[{"id":"file-1","kind":"file","name":"notes.md","path":"/tmp/notes.md","mimeType":"text/markdown","status":"ready"}]',
				payloadJson: '{"mode":"build"}',
			},
			{
				id: "draft-malformed-payload",
				status: "active",
				version: 1,
				mode: "ask",
				attachmentsJson: "[]",
				payloadJson: "{bad-json",
			},
			{
				id: "draft-promoted",
				status: "promoted",
				version: 1,
				mode: "ask",
				attachmentsJson: "[]",
				payloadJson: "{}",
			},
		]);
	});
});

function tempDbPath() {
	const dir = mkdtempSync(join(tmpdir(), "experimental-desktop-db-"));
	tempDirs.push(dir);
	return join(dir, "conversations.sqlite");
}
