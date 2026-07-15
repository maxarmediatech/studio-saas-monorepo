import { spawn } from "node:child_process";
import { access, chmod, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { Client } from "pg";

const MAX_ERROR_LENGTH = 4_000;

function isLocalDatabase(connectionUrl: string): boolean {
	const host = new URL(connectionUrl).hostname;
	return host === "" || host === "localhost" || host === "127.0.0.1";
}

function getDatabaseName(connectionUrl: string): string {
	const url = new URL(connectionUrl);
	const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
	if (!database) {
		throw new Error("Database URL must include a database name");
	}
	return database;
}

function replaceDatabaseName(connectionUrl: string, database: string): string {
	const url = new URL(connectionUrl);
	url.pathname = `/${database}`;
	return url.toString();
}

export function nodeConnectionString(connectionUrl: string): string {
	const url = new URL(connectionUrl);
	if (url.searchParams.get("sslrootcert") === "system") {
		url.searchParams.delete("sslrootcert");
	}
	return url.toString();
}

function createClient(connectionUrl: string): Client {
	return new Client({
		connectionString: nodeConnectionString(connectionUrl),
	});
}

function connectionEnvironment(connectionUrl: string): NodeJS.ProcessEnv {
	const url = new URL(connectionUrl);
	const env: NodeJS.ProcessEnv = { ...process.env };
	const sslMode = url.searchParams.get("sslmode") || undefined;
	const sslRootCert =
		url.searchParams.get("sslrootcert") ||
		(sslMode === "verify-full" || sslMode === "verify-ca"
			? "system"
			: undefined);
	const values: Record<string, string | undefined> = {
		PGHOST: url.hostname || undefined,
		PGPORT: url.port || undefined,
		PGUSER: url.username ? decodeURIComponent(url.username) : undefined,
		PGPASSWORD: url.password ? decodeURIComponent(url.password) : undefined,
		PGDATABASE: getDatabaseName(connectionUrl),
		PGSSLMODE: sslMode,
		PGSSLROOTCERT: sslRootCert,
		PGSSLCERT: url.searchParams.get("sslcert") || undefined,
		PGSSLKEY: url.searchParams.get("sslkey") || undefined,
	};

	for (const [name, value] of Object.entries(values)) {
		if (value) {
			env[name] = value;
		} else {
			delete env[name];
		}
	}
	return env;
}

async function findPostgresBinary(name: string): Promise<string> {
	const configured = process.env.PG_BIN_DIR?.trim();
	const candidates = [
		configured ? join(configured, name) : undefined,
		`/opt/homebrew/opt/postgresql@18/bin/${name}`,
		`/usr/local/opt/postgresql@18/bin/${name}`,
		name,
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidates) {
		if (candidate === name) {
			return candidate;
		}
		try {
			await access(candidate);
			return candidate;
		} catch {
			// Try the next known installation path.
		}
	}
	throw new Error(`Unable to locate PostgreSQL tool: ${name}`);
}

function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
	return new Promise((resolve) => {
		let output = "";
		stream.setEncoding("utf8");
		stream.on("data", (chunk: string) => {
			if (output.length < MAX_ERROR_LENGTH) {
				output += chunk;
			}
		});
		stream.on("end", () => resolve(output.trim()));
	});
}

function waitForExit(
	child: ReturnType<typeof spawn>,
	label: string,
	stderr: Promise<string>,
): Promise<void> {
	return new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", async (code) => {
			const detail = await stderr;
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${label} failed${detail ? `: ${detail}` : ""}`));
		});
	});
}

async function runTool(
	name: string,
	args: string[],
	connectionUrl: string,
): Promise<void> {
	const binary = await findPostgresBinary(name);
	const child = spawn(binary, args, {
		env: connectionEnvironment(connectionUrl),
		stdio: ["ignore", "ignore", "pipe"],
	});
	await waitForExit(child, name, collectStream(child.stderr));
}

export async function createLocalDatabase(
	adminUrl: string,
	databaseName: string,
): Promise<string> {
	if (!/^stuwiz_sanitize_[a-z0-9_]+$/.test(databaseName)) {
		throw new Error("Unsafe temporary database name");
	}
	await runTool("createdb", [databaseName], adminUrl);
	return replaceDatabaseName(adminUrl, databaseName);
}

export async function assertReadOnlySource(
	connectionUrl: string,
): Promise<void> {
	if (isLocalDatabase(connectionUrl)) {
		return;
	}
	const client = createClient(connectionUrl);
	await client.connect();
	try {
		const result = await client.query<{ writableTables: string }>(`
			SELECT count(*)::text AS "writableTables"
			FROM pg_class class
			JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
			WHERE namespace.nspname = 'public'
				AND class.relkind IN ('r', 'p')
				AND (
					has_table_privilege(current_user, class.oid, 'INSERT')
					OR has_table_privilege(current_user, class.oid, 'UPDATE')
					OR has_table_privilege(current_user, class.oid, 'DELETE')
					OR has_table_privilege(current_user, class.oid, 'TRUNCATE')
				)
		`);
		if (result.rows[0]?.writableTables !== "0") {
			throw new Error(
				"PRODUCTION_DATABASE_URL must use a role with SELECT-only access to public tables",
			);
		}
	} finally {
		await client.end();
	}
}

export async function dropLocalDatabase(
	adminUrl: string,
	databaseName: string,
): Promise<void> {
	if (!/^stuwiz_sanitize_[a-z0-9_]+$/.test(databaseName)) {
		throw new Error("Refusing to drop an unrecognized database name");
	}
	await runTool("dropdb", ["--if-exists", databaseName], adminUrl);
}

export async function copyDatabase(
	sourceUrl: string,
	targetUrl: string,
): Promise<void> {
	const [pgDump, pgRestore] = await Promise.all([
		findPostgresBinary("pg_dump"),
		findPostgresBinary("pg_restore"),
	]);
	const dump = spawn(
		pgDump,
		[
			"--format=custom",
			"--no-owner",
			"--no-privileges",
			"--exclude-schema=pscale_extensions",
			"--exclude-schema=stuwiz_ops",
			"--exclude-extension=hypopg",
		],
		{
			env: connectionEnvironment(sourceUrl),
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const restore = spawn(
		pgRestore,
		[
			"--dbname",
			getDatabaseName(targetUrl),
			"--no-owner",
			"--no-privileges",
			"--exit-on-error",
		],
		{
			env: connectionEnvironment(targetUrl),
			stdio: ["pipe", "ignore", "pipe"],
		},
	);

	if (!dump.stdout || !restore.stdin) {
		throw new Error("Unable to create PostgreSQL copy pipeline");
	}
	dump.stdout.pipe(restore.stdin);
	const results = await Promise.allSettled([
		waitForExit(dump, "pg_dump", collectStream(dump.stderr)),
		waitForExit(restore, "pg_restore", collectStream(restore.stderr)),
	]);
	const failures = results
		.filter(
			(result): result is PromiseRejectedResult =>
				result.status === "rejected",
		)
		.map((result) => result.reason);
	if (failures.length > 0) {
		throw new AggregateError(failures, "PostgreSQL copy pipeline failed");
	}
}

export async function dumpDatabase(
	connectionUrl: string,
	archivePath: string,
): Promise<void> {
	await mkdir(dirname(archivePath), { recursive: true, mode: 0o700 });
	await runTool(
		"pg_dump",
		[
			"--format=custom",
			"--no-owner",
			"--no-privileges",
			"--exclude-schema=pscale_extensions",
			"--exclude-schema=stuwiz_ops",
			"--exclude-extension=hypopg",
			"--file",
			archivePath,
		],
		connectionUrl,
	);
	await chmod(archivePath, 0o600);
}

export async function restoreDatabase(
	connectionUrl: string,
	archivePath: string,
): Promise<void> {
	await runTool(
		"pg_restore",
		[
			"--dbname",
			getDatabaseName(connectionUrl),
			"--no-owner",
			"--no-privileges",
			"--exit-on-error",
			archivePath,
		],
		connectionUrl,
	);
}

export async function resetApplicationSchemas(
	connectionUrl: string,
): Promise<void> {
	const client = createClient(connectionUrl);
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("DROP SCHEMA IF EXISTS drizzle CASCADE");
		await client.query("DROP SCHEMA IF EXISTS public CASCADE");
		await client.query("CREATE SCHEMA public");
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		await client.end();
	}
}

export async function initializeStagingGuard(
	connectionUrl: string,
	tokenHash: string,
): Promise<void> {
	const client = createClient(connectionUrl);
	await client.connect();
	try {
		await client.query("BEGIN");
		await client.query("CREATE SCHEMA IF NOT EXISTS stuwiz_ops");
		await client.query(`
			CREATE TABLE IF NOT EXISTS stuwiz_ops.environment_guard (
				id boolean PRIMARY KEY DEFAULT true CHECK (id),
				token_hash text NOT NULL,
				created_at timestamp with time zone NOT NULL DEFAULT now()
			)
		`);
		await client.query(
			`INSERT INTO stuwiz_ops.environment_guard (id, token_hash)
			VALUES (true, $1)
			ON CONFLICT (id) DO UPDATE
			SET token_hash = excluded.token_hash, created_at = now()`,
			[tokenHash],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	} finally {
		await client.end();
	}
}

export async function assertStagingGuard(
	connectionUrl: string,
	tokenHash: string,
): Promise<void> {
	const client = createClient(connectionUrl);
	await client.connect();
	try {
		const result = await client.query<{ matches: boolean }>(
			`SELECT EXISTS (
				SELECT 1 FROM stuwiz_ops.environment_guard
				WHERE id = true AND token_hash = $1
			) AS matches`,
			[tokenHash],
		);
		if (result.rows[0]?.matches !== true) {
			throw new Error(
				"STAGING_DATABASE_URL did not pass the staging environment guard",
			);
		}
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("staging environment guard")
		) {
			throw error;
		}
		throw new Error(
			"STAGING_DATABASE_URL has no valid staging environment guard",
		);
	} finally {
		await client.end();
	}
}
