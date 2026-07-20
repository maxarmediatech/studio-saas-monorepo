import { createHash } from "node:crypto";
import { chmod, readFile, rename, writeFile } from "node:fs/promises";
import { Client } from "pg";
import {
	databaseIdentity,
	loadBuildConfig,
	loadPublishConfig,
	loadVerifyConfig,
} from "./config";
import {
	assertReadOnlySource,
	assertStagingGuard,
	copyDatabase,
	createLocalDatabase,
	dropLocalDatabase,
	dumpDatabase,
	initializeStagingGuard,
	nodeConnectionString,
	resetApplicationSchemas,
	restoreDatabase,
} from "./postgres-tools";
import { sanitizeDatabase } from "./sanitize";
import { CLEARED_AUTH_TABLES } from "./sanitizers/auth";
import {
	assertCriticalSchemaStructures,
	assertSchemaMatchesContract,
	fingerprintSchema,
	loadSchemaContract,
	readApplicationSchema,
	readTableCounts,
} from "./schema-contract";
import { SNAPSHOT_MANIFEST_VERSION, type SnapshotManifest } from "./types";
import {
	parseManifest,
	sha256File,
	validateSanitizedDatabase,
} from "./validate";

async function writeManifest(
	manifestPath: string,
	manifest: SnapshotManifest,
): Promise<void> {
	const temporaryPath = `${manifestPath}.tmp`;
	await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, {
		mode: 0o600,
	});
	await rename(temporaryPath, manifestPath);
	await chmod(manifestPath, 0o600);
}

async function readManifest(manifestPath: string): Promise<SnapshotManifest> {
	return parseManifest(JSON.parse(await readFile(manifestPath, "utf8")));
}

async function buildSnapshot(): Promise<void> {
	const config = loadBuildConfig();
	const databaseName = `stuwiz_sanitize_${Date.now()}_${process.pid}`;
	let localUrl: string | undefined;
	let client: Client | undefined;
	let snapshotValidated = false;

	console.log("Creating temporary local sanitization database...");
	try {
		await assertReadOnlySource(config.productionUrl);
		localUrl = await createLocalDatabase(
			config.localAdminUrl,
			databaseName,
		);
		console.log("Streaming production snapshot into local PostgreSQL...");
		await copyDatabase(config.productionUrl, localUrl);

		client = new Client({
			connectionString: nodeConnectionString(localUrl),
		});
		await client.connect();
		const contract = await loadSchemaContract();
		const sourceSchema = await readApplicationSchema(client);
		assertSchemaMatchesContract(contract, sourceSchema);
		await assertCriticalSchemaStructures(client);
		const sourceSchemaFingerprint = await fingerprintSchema(
			client,
			sourceSchema,
		);
		const tableCountsBefore = await readTableCounts(client, contract);

		console.log("Sanitizing local snapshot...");
		await sanitizeDatabase(client, config.sanitizationKey, {
			email: config.stagingAdminEmail,
			password: config.stagingAdminPassword,
		});
		const { sanitizedSchemaFingerprint, tableCountsAfter } =
			await validateSanitizedDatabase(
				client,
				contract,
				sourceSchemaFingerprint,
				tableCountsBefore,
			);

		await client.end();
		client = undefined;
		console.log("Writing validated sanitized archive...");
		await dumpDatabase(localUrl, config.archivePath);
		const archiveSha256 = await sha256File(config.archivePath);
		snapshotValidated = true;
		const manifest: SnapshotManifest = {
			version: SNAPSHOT_MANIFEST_VERSION,
			createdAt: new Date().toISOString(),
			sourceSchemaFingerprint,
			sanitizedSchemaFingerprint,
			schemaSnapshotTag: contract.snapshotTag,
			tableCountsBefore,
			tableCountsAfter,
			clearedTables: [...CLEARED_AUTH_TABLES],
			archiveSha256,
			validation: {
				schemaPreserved: true,
				businessRowCountsPreserved: true,
				secretsRemoved: true,
				outboundWorkDisabled: true,
			},
		};
		await writeManifest(config.manifestPath, manifest);
		console.log(`Sanitized snapshot ready: ${config.archivePath}`);
	} finally {
		if (client) {
			await client.end().catch(() => undefined);
		}
		if (localUrl && (!config.keepLocalDatabase || !snapshotValidated)) {
			await dropLocalDatabase(config.localAdminUrl, databaseName);
		} else if (localUrl) {
			console.log(`Kept sanitized local database: ${databaseName}`);
		}
	}
}

async function verifyRemoteSnapshot(
	stagingUrl: string,
	manifest: SnapshotManifest,
): Promise<void> {
	const client = new Client({
		connectionString: nodeConnectionString(stagingUrl),
	});
	await client.connect();
	try {
		const contract = await loadSchemaContract();
		if (contract.snapshotTag !== manifest.schemaSnapshotTag) {
			throw new Error(
				`Manifest uses ${manifest.schemaSnapshotTag}, but this branch expects ${contract.snapshotTag}`,
			);
		}
		const result = await validateSanitizedDatabase(
			client,
			contract,
			manifest.sourceSchemaFingerprint,
			manifest.tableCountsBefore,
		);
		if (
			JSON.stringify(result.tableCountsAfter) !==
			JSON.stringify(manifest.tableCountsAfter)
		) {
			throw new Error(
				"Staging row counts do not match the validated snapshot",
			);
		}
	} finally {
		await client.end();
	}
}

async function publishSnapshot(): Promise<void> {
	const config = loadPublishConfig();
	const expectedConfirmation = databaseIdentity(config.stagingUrl);
	if (config.resetConfirmation !== expectedConfirmation) {
		throw new Error(
			`STAGING_RESET_CONFIRM must exactly equal ${expectedConfirmation}`,
		);
	}
	const guardHash = createHash("sha256")
		.update(config.stagingGuardToken)
		.digest("hex");
	await assertStagingGuard(config.stagingUrl, guardHash);

	const manifest = await readManifest(config.manifestPath);
	if ((await sha256File(config.archivePath)) !== manifest.archiveSha256) {
		throw new Error("Sanitized archive hash does not match its manifest");
	}

	const rollbackArchive = `${config.archivePath}.previous-staging.dump`;
	console.log("Saving rollback snapshot of the existing staging database...");
	await dumpDatabase(config.stagingUrl, rollbackArchive);

	let stagingWasReset = false;
	try {
		console.log(`Replacing staging database ${expectedConfirmation}...`);
		await resetApplicationSchemas(config.stagingUrl);
		stagingWasReset = true;
		await restoreDatabase(config.stagingUrl, config.archivePath);
		await verifyRemoteSnapshot(config.stagingUrl, manifest);
		console.log("Staging database published and verified.");
	} catch (publishError) {
		if (!stagingWasReset) {
			throw publishError;
		}
		console.error(
			"Publish failed; restoring the previous staging snapshot...",
		);
		try {
			await resetApplicationSchemas(config.stagingUrl);
			await restoreDatabase(config.stagingUrl, rollbackArchive);
		} catch (rollbackError) {
			throw new AggregateError(
				[publishError, rollbackError],
				"Publish and automatic staging rollback both failed",
			);
		}
		throw publishError;
	}
}

async function initializeGuard(): Promise<void> {
	const config = loadPublishConfig();
	const expectedConfirmation = databaseIdentity(config.stagingUrl);
	if (config.resetConfirmation !== expectedConfirmation) {
		throw new Error(
			`STAGING_RESET_CONFIRM must exactly equal ${expectedConfirmation}`,
		);
	}
	const guardHash = createHash("sha256")
		.update(config.stagingGuardToken)
		.digest("hex");
	await initializeStagingGuard(config.stagingUrl, guardHash);
	console.log(`Staging guard initialized for ${expectedConfirmation}.`);
}

async function verifySnapshot(): Promise<void> {
	const config = loadVerifyConfig();
	const manifest = await readManifest(config.manifestPath);
	await verifyRemoteSnapshot(config.stagingUrl, manifest);
	console.log("Staging database matches the sanitized snapshot.");
}

async function main(): Promise<void> {
	const command = process.argv[2];
	if (command === "build") {
		await buildSnapshot();
		return;
	}
	if (command === "publish") {
		await publishSnapshot();
		return;
	}
	if (command === "verify") {
		await verifySnapshot();
		return;
	}
	if (command === "init-guard") {
		await initializeGuard();
		return;
	}
	throw new Error("Usage: staging-clone <build|init-guard|publish|verify>");
}

function formatError(error: unknown): string {
	if (error instanceof AggregateError) {
		const details = error.errors.map(formatError).join("; ");
		return `${error.message}${details ? `: ${details}` : ""}`;
	}
	return error instanceof Error ? error.message : String(error);
}

main().catch((error: unknown) => {
	const message = formatError(error);
	console.error(`Staging clone failed: ${message}`);
	process.exitCode = 1;
});
