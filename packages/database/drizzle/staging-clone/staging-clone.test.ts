import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertDifferentDatabases,
	databaseIdentity,
	loadBuildConfig,
} from "./config";
import { nodeConnectionString } from "./postgres-tools";
import { hashStagingPassword } from "./sanitizers/auth";
import { loadSchemaContract } from "./schema-contract";
import { SNAPSHOT_MANIFEST_VERSION } from "./types";
import { parseManifest } from "./validate";

describe("staging clone safeguards", () => {
	it("builds a credential-free confirmation identity", () => {
		assert.equal(
			databaseIdentity(
				"postgresql://user:secret@staging.example.com:5432/stuwiz?sslmode=require",
			),
			"staging.example.com:5432/stuwiz",
		);
	});

	it("distinguishes PlanetScale branches sharing one regional endpoint", () => {
		const production =
			"postgresql://reader.main123:secret@ap-south-2.pg.psdb.cloud:5432/postgres";
		const staging =
			"postgresql://admin.stage456:secret@ap-south-2.pg.psdb.cloud:5432/postgres";
		assert.equal(
			databaseIdentity(production),
			"ap-south-2.pg.psdb.cloud:5432/postgres@main123",
		);
		assert.doesNotThrow(() =>
			assertDifferentDatabases(production, staging),
		);
		assert.throws(() =>
			assertDifferentDatabases(
				production,
				production.replace("reader.main123", "other-role.main123"),
			),
		);
	});

	it("uses platform trust roots for PlanetScale Node connections", () => {
		const connection = nodeConnectionString(
			"postgresql://reader:secret@db.example.com:5432/app?sslmode=verify-full&sslrootcert=system",
		);
		const parsed = new URL(connection);
		assert.equal(parsed.searchParams.get("sslmode"), "verify-full");
		assert.equal(parsed.searchParams.has("sslrootcert"), false);
	});

	it("rejects production and staging pointing to the same database", () => {
		assert.throws(() =>
			assertDifferentDatabases(
				"postgresql://prod:one@db.example.com/app",
				"postgresql://staging:two@db.example.com/app",
			),
		);
	});

	it("leaves the staging administrator password policy to the operator", () => {
		const previous = {
			productionUrl: process.env.PRODUCTION_DATABASE_URL,
			sanitizationKey: process.env.SANITIZATION_KEY,
			adminEmail: process.env.STAGING_ADMIN_EMAIL,
			adminPassword: process.env.STAGING_ADMIN_PASSWORD,
		};
		process.env.PRODUCTION_DATABASE_URL =
			"postgresql://readonly:secret@production.example.com:6432/app";
		process.env.SANITIZATION_KEY = "a".repeat(32);
		process.env.STAGING_ADMIN_EMAIL = "operator@example.com";
		process.env.STAGING_ADMIN_PASSWORD = "chosen";

		try {
			const config = loadBuildConfig();
			assert.equal(config.stagingAdminPassword, "chosen");
			assert.equal(new URL(config.productionUrl).port, "5432");
		} finally {
			for (const [name, value] of [
				["PRODUCTION_DATABASE_URL", previous.productionUrl],
				["SANITIZATION_KEY", previous.sanitizationKey],
				["STAGING_ADMIN_EMAIL", previous.adminEmail],
				["STAGING_ADMIN_PASSWORD", previous.adminPassword],
			] as const) {
				if (value === undefined) {
					delete process.env[name];
				} else {
					process.env[name] = value;
				}
			}
		}
	});

	it("accepts only fully validated manifests", () => {
		const manifest = {
			version: SNAPSHOT_MANIFEST_VERSION,
			createdAt: "2026-07-15T00:00:00.000Z",
			sourceSchemaFingerprint: "schema",
			sanitizedSchemaFingerprint: "schema",
			schemaSnapshotTag: "0037_absurd_shriek",
			tableCountsBefore: { users: "1" },
			tableCountsAfter: { users: "1" },
			clearedTables: [],
			archiveSha256: "archive",
			validation: {
				schemaPreserved: true,
				businessRowCountsPreserved: true,
				secretsRemoved: true,
				outboundWorkDisabled: true,
			},
		};
		assert.equal(parseManifest(manifest).archiveSha256, "archive");
		assert.throws(() =>
			parseManifest({
				...manifest,
				validation: { ...manifest.validation, secretsRemoved: false },
			}),
		);
	});

	it("creates Better Auth-compatible password hash shapes", async () => {
		const first = await hashStagingPassword("staging-password-123");
		const second = await hashStagingPassword("staging-password-123");
		assert.match(first, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
		assert.notEqual(first, second);
	});

	it("is pinned to the reviewed Drizzle snapshot", async () => {
		const contract = await loadSchemaContract();
		assert.equal(contract.snapshotTag, "0037_absurd_shriek");
		assert.ok(Object.keys(contract.tables).length > 60);
	});
});
