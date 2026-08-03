import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import pg from "pg";

const databaseUrl = process.env.POSTGRES_CONCURRENCY_DATABASE_URL;

test(
	"0053 upgrades only exact legacy-default manager permissions",
	{ skip: !databaseUrl },
	async () => {
		const client = new pg.Client({ connectionString: databaseUrl });
		await client.connect();
		try {
			await client.query("BEGIN");
			await client.query(`
				CREATE TEMP TABLE organization_roles (
					id text PRIMARY KEY,
					role text NOT NULL,
					permission text NOT NULL,
					updated_at timestamptz
				) ON COMMIT DROP
			`);
			const legacy = {
				organization: [],
				member: [],
				invitation: [],
				team: [],
				ac: ["read"],
				dashboard: ["read"],
				review: ["list", "claim", "review", "approve"],
				booking: ["read", "update", "list"],
				client: ["read", "list"],
				shoot: ["create", "read", "update", "list", "assign"],
				deliverable: [
					"create",
					"read",
					"update",
					"delete",
					"list",
					"assign",
					"submit",
					"review",
					"approve",
				],
				task: [
					"create",
					"read",
					"update",
					"delete",
					"list",
					"assign",
					"submit",
					"review",
					"approve",
				],
				expense: ["read", "list"],
				payment: ["read", "list"],
				crew: ["read", "list"],
				configuration: ["read", "list"],
			};
			const customized = { ...legacy, booking: ["read"] };
			await client.query(
				"INSERT INTO organization_roles (id, role, permission) VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)",
				[
					"legacy",
					"manager",
					JSON.stringify(legacy),
					"custom",
					"manager",
					JSON.stringify(customized),
					"other",
					"hr",
					JSON.stringify(legacy),
				],
			);
			const migration = await readFile(
				new URL(
					"../migrations/0053_manager_quote_permissions.sql",
					import.meta.url,
				),
				"utf8",
			);
			await client.query(migration);
			const result = await client.query<{
				id: string;
				permission: string;
			}>("SELECT id, permission FROM organization_roles ORDER BY id");
			const permissions = new Map(
				result.rows.map((row) => [row.id, JSON.parse(row.permission)]),
			);
			assert.deepEqual(permissions.get("custom"), customized);
			assert.deepEqual(permissions.get("other"), legacy);
			assert.deepEqual(permissions.get("legacy"), {
				...legacy,
				quote: ["update", "list", "send", "revise"],
			});
		} finally {
			await client.query("ROLLBACK").catch(() => undefined);
			await client.end();
		}
	},
);
