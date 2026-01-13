import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { Client } from "pg";

type Journal = {
	entries: {
		tag: string;
		when: number;
		breakpoints?: boolean;
	}[];
};

function sha256(text: string) {
	return crypto.createHash("sha256").update(text).digest("hex");
}

function readJournal(migrationsFolder: string): Journal {
	const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
	const journalRaw = fs.readFileSync(journalPath, "utf8");
	return JSON.parse(journalRaw) as Journal;
}

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		throw new Error("DATABASE_URL is not set");
	}

	const migrationsFolder = path.join(process.cwd(), "drizzle", "migrations");
	const journal = readJournal(migrationsFolder);
	if (!journal.entries.length) {
		throw new Error("No migrations found in meta/_journal.json");
	}

	const latestEntry = journal.entries.reduce((latest, current) => {
		return current.when > latest.when ? current : latest;
	});

	const migrationSqlPath = path.join(migrationsFolder, `${latestEntry.tag}.sql`);
	const migrationSql = fs.readFileSync(migrationSqlPath, "utf8");
	const hash = sha256(migrationSql);

	const client = new Client({
		connectionString: databaseUrl,
	});

	await client.connect();
	try {
		await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle";');
		await client.query(`
			CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
				id SERIAL PRIMARY KEY,
				hash text NOT NULL,
				created_at bigint
			);
		`);

		const maxResult = await client.query<{ max: string | null }>(
			'SELECT MAX(created_at)::text AS max FROM "drizzle"."__drizzle_migrations";',
		);
		const alreadyAppliedMax = maxResult.rows[0]?.max ? Number(maxResult.rows[0].max) : null;

		if (alreadyAppliedMax !== null && alreadyAppliedMax >= latestEntry.when) {
			// Migration baseline already at or beyond this repo's latest migration.
			process.stdout.write(
				`Baseline already present (db max created_at=${alreadyAppliedMax}, repo latest=${latestEntry.when}).\n`,
			);
			return;
		}

		const existsResult = await client.query(
			'SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE created_at = $1 LIMIT 1;',
			[latestEntry.when],
		);
		if (existsResult.rowCount && existsResult.rowCount > 0) {
			process.stdout.write(
				`Baseline row already exists for created_at=${latestEntry.when} (${latestEntry.tag}).\n`,
			);
			return;
		}

		await client.query(
			'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2);',
			[hash, latestEntry.when],
		);

		process.stdout.write(
			`Baselined ${latestEntry.tag} (created_at=${latestEntry.when}, hash=${hash}).\n`,
		);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});

