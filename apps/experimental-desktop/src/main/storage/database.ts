import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";

const migrations = [
	{
		id: "0001_conversation_layer",
		sql: `
CREATE TABLE drafts (
	id TEXT PRIMARY KEY,
	text TEXT NOT NULL DEFAULT '',
	cwd TEXT,
	model TEXT,
	runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('read-only', 'workspace-write', 'full-access')),
	attachments_json TEXT NOT NULL DEFAULT '[]',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	promoted_conversation_id TEXT
);

CREATE UNIQUE INDEX drafts_promoted_conversation_id_unique
	ON drafts(promoted_conversation_id)
	WHERE promoted_conversation_id IS NOT NULL;

CREATE TABLE conversations (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL,
	cwd TEXT NOT NULL,
	model TEXT,
	runtime_mode TEXT NOT NULL CHECK (runtime_mode IN ('read-only', 'workspace-write', 'full-access')),
	status TEXT NOT NULL CHECK (status IN ('active', 'idle', 'waiting_approval', 'failed', 'archived', 'deleted')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	last_message_at TEXT,
	archived_at TEXT,
	deleted_at TEXT
);

CREATE INDEX conversations_updated_at_idx ON conversations(updated_at);
CREATE INDEX conversations_status_updated_at_idx ON conversations(status, updated_at);

CREATE TABLE provider_sessions (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
	provider TEXT NOT NULL CHECK (provider IN ('codex')),
	provider_thread_id TEXT,
	provider_state_json TEXT NOT NULL DEFAULT '{}',
	status TEXT NOT NULL CHECK (status IN ('starting', 'active', 'idle', 'failed')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX provider_sessions_thread_id_unique
	ON provider_sessions(provider_thread_id)
	WHERE provider_thread_id IS NOT NULL;

CREATE TABLE turns (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	provider_session_id TEXT NOT NULL REFERENCES provider_sessions(id) ON DELETE CASCADE,
	provider_turn_id TEXT,
	user_message_id TEXT NOT NULL,
	assistant_message_id TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'waiting_approval', 'completed', 'failed', 'canceled')),
	error_json TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT
);

CREATE INDEX turns_conversation_id_idx ON turns(conversation_id);
CREATE INDEX turns_provider_turn_id_idx ON turns(provider_turn_id);

CREATE TABLE messages (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
	ordinal INTEGER NOT NULL,
	role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
	status TEXT NOT NULL CHECK (status IN ('pending', 'streaming', 'completed', 'failed', 'interrupted')),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX messages_conversation_ordinal_unique ON messages(conversation_id, ordinal);
CREATE INDEX messages_turn_id_idx ON messages(turn_id);

CREATE TABLE message_parts (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
	turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
	provider_item_id TEXT,
	ordinal INTEGER NOT NULL,
	type TEXT NOT NULL CHECK (type IN ('text', 'tool_call', 'tool_result', 'approval', 'raw')),
	text TEXT,
	json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX message_parts_message_ordinal_unique ON message_parts(message_id, ordinal);
CREATE INDEX message_parts_conversation_id_idx ON message_parts(conversation_id);
CREATE INDEX message_parts_turn_id_idx ON message_parts(turn_id);

CREATE TABLE events (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	provider_session_id TEXT REFERENCES provider_sessions(id) ON DELETE SET NULL,
	turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
	provider_event_id TEXT,
	type TEXT NOT NULL,
	raw_json TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL
);

CREATE INDEX events_conversation_created_at_idx ON events(conversation_id, created_at);
CREATE INDEX events_turn_id_idx ON events(turn_id);

CREATE TABLE approvals (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
	provider_request_id TEXT NOT NULL,
	provider_item_id TEXT,
	kind TEXT NOT NULL CHECK (kind IN ('command', 'file-change', 'user-input', 'unknown')),
	status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'accepted_for_session', 'declined', 'canceled', 'expired', 'failed')),
	request_json TEXT NOT NULL DEFAULT '{}',
	response_json TEXT,
	created_at TEXT NOT NULL,
	resolved_at TEXT,
	expires_at TEXT
);

CREATE UNIQUE INDEX approvals_live_request_id_unique
	ON approvals(provider_request_id)
	WHERE status = 'pending';
CREATE INDEX approvals_conversation_id_idx ON approvals(conversation_id);
CREATE INDEX approvals_turn_id_idx ON approvals(turn_id);
`,
	},
	{
		id: "0002_conversation_tree",
		sql: `
ALTER TABLE conversations ADD COLUMN parent_conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN branched_from_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN branched_from_turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN branch_origin_provider_thread_id TEXT;
ALTER TABLE conversations ADD COLUMN active_leaf_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE provider_sessions ADD COLUMN provider_leaf_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN parent_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;

UPDATE messages
SET parent_message_id = (
	SELECT previous.id
	FROM messages previous
	WHERE previous.conversation_id = messages.conversation_id
		AND previous.ordinal = messages.ordinal - 1
)
WHERE parent_message_id IS NULL AND ordinal > 0;

UPDATE conversations
SET active_leaf_message_id = (
	SELECT m.id
	FROM messages m
	WHERE m.conversation_id = conversations.id
	ORDER BY m.ordinal DESC
	LIMIT 1
)
WHERE active_leaf_message_id IS NULL;

UPDATE provider_sessions
SET provider_leaf_message_id = (
	SELECT c.active_leaf_message_id
	FROM conversations c
	WHERE c.id = provider_sessions.conversation_id
)
WHERE provider_leaf_message_id IS NULL AND provider_thread_id IS NOT NULL;

CREATE INDEX conversations_parent_conversation_id_idx ON conversations(parent_conversation_id);
CREATE INDEX conversations_active_leaf_message_id_idx ON conversations(active_leaf_message_id);
CREATE INDEX conversations_branched_from_message_id_idx ON conversations(branched_from_message_id);
CREATE INDEX provider_sessions_provider_leaf_message_id_idx ON provider_sessions(provider_leaf_message_id);
CREATE INDEX messages_parent_message_id_idx ON messages(parent_message_id);
`,
	},
	{
		id: "0003_conversation_summaries",
		sql: `
CREATE TABLE conversation_summaries (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	type TEXT NOT NULL CHECK (type IN ('branch', 'fork', 'compaction')),
	summary TEXT NOT NULL,
	abandoned_leaf_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
	first_kept_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
	tokens_before INTEGER,
	created_at TEXT NOT NULL
);

CREATE INDEX conversation_summaries_conversation_created_at_idx
	ON conversation_summaries(conversation_id, created_at);
CREATE INDEX conversation_summaries_first_kept_message_id_idx
	ON conversation_summaries(first_kept_message_id);
`,
	},
	{
		id: "0004_compaction_boundaries",
		sql: `
ALTER TABLE conversation_summaries ADD COLUMN checkpoint_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;
ALTER TABLE conversation_summaries ADD COLUMN tail_start_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL;

UPDATE conversation_summaries
SET checkpoint_message_id = first_kept_message_id
WHERE type IN ('branch', 'fork') AND checkpoint_message_id IS NULL;

UPDATE conversation_summaries
SET tail_start_message_id = first_kept_message_id
WHERE type = 'compaction' AND tail_start_message_id IS NULL;

CREATE INDEX conversation_summaries_checkpoint_message_id_idx
	ON conversation_summaries(checkpoint_message_id);
CREATE INDEX conversation_summaries_tail_start_message_id_idx
	ON conversation_summaries(tail_start_message_id);
CREATE INDEX conversation_summaries_conversation_type_created_at_idx
	ON conversation_summaries(conversation_id, type, created_at);
`,
	},
	{
		id: "0005_draft_payload",
		sql: `
ALTER TABLE drafts ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
`,
	},
	{
		id: "0006_admitted_requests_queue",
		sql: `
CREATE TABLE admitted_requests (
	id TEXT PRIMARY KEY,
	conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
	draft_id TEXT REFERENCES drafts(id) ON DELETE SET NULL,
	turn_id TEXT REFERENCES turns(id) ON DELETE SET NULL,
	provider TEXT NOT NULL CHECK (provider IN ('codex')),
	status TEXT NOT NULL CHECK (status IN ('admitted', 'queued', 'running', 'completed', 'failed', 'canceled')),
	draft_snapshot_json TEXT NOT NULL DEFAULT '{}',
	request_parts_json TEXT NOT NULL DEFAULT '[]',
	provider_input_json TEXT NOT NULL DEFAULT '{}',
	admission_json TEXT NOT NULL DEFAULT '{}',
	compatibility_payload_json TEXT NOT NULL DEFAULT '{}',
	error_json TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX admitted_requests_conversation_id_idx
	ON admitted_requests(conversation_id, created_at);
CREATE INDEX admitted_requests_turn_id_idx ON admitted_requests(turn_id);

CREATE TABLE queue_items (
	id TEXT PRIMARY KEY,
	conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
	admitted_request_id TEXT NOT NULL REFERENCES admitted_requests(id) ON DELETE CASCADE,
	position INTEGER NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'canceled')),
	error_json TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX queue_items_conversation_position_unique
	ON queue_items(conversation_id, position)
	WHERE status = 'queued';
CREATE INDEX queue_items_conversation_status_idx
	ON queue_items(conversation_id, status, position);
`,
	},
	{
		id: "0007_composer_draft_targets",
		sql: `
ALTER TABLE drafts ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE drafts ADD COLUMN mode TEXT NOT NULL DEFAULT 'ask';
ALTER TABLE drafts ADD COLUMN conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE drafts ADD COLUMN scope_key TEXT;
ALTER TABLE drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
	CHECK (status IN ('active', 'promoting', 'promoted', 'discarded'));
ALTER TABLE drafts ADD COLUMN last_restored_at TEXT;
ALTER TABLE drafts ADD COLUMN last_error TEXT;

UPDATE drafts
SET status = 'promoted'
WHERE promoted_conversation_id IS NOT NULL;

CREATE INDEX drafts_target_status_idx
	ON drafts(conversation_id, scope_key, status, updated_at);
CREATE INDEX drafts_status_updated_at_idx
	ON drafts(status, updated_at);
`,
	},
];

export type ConversationDatabase = Database.Database;

export function openConversationDatabase(path: string) {
	mkdirSync(dirname(path), { recursive: true });
	const db = new Database(path);
	db.pragma("journal_mode = WAL");
	db.pragma("foreign_keys = ON");
	db.pragma("busy_timeout = 5000");
	db.exec(`
CREATE TABLE IF NOT EXISTS schema_migrations (
	id TEXT PRIMARY KEY,
	applied_at TEXT NOT NULL
);
`);
	for (const migration of migrations) {
		const applied = db
			.prepare("SELECT 1 FROM schema_migrations WHERE id = ?")
			.get(migration.id);
		if (applied) {
			continue;
		}
		const apply = db.transaction(() => {
			db.exec(migration.sql);
			db.prepare(
				"INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)",
			).run(migration.id, new Date().toISOString());
		});
		apply();
	}
	return db;
}

export function checkDatabaseIntegrity(db: ConversationDatabase) {
	const row = db.prepare("PRAGMA integrity_check").get() as
		| { integrity_check?: string }
		| undefined;
	return row?.integrity_check === "ok";
}
