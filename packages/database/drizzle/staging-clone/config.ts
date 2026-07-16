import { homedir } from "node:os";
import { join } from "node:path";

export type BuildConfig = {
	productionUrl: string;
	localAdminUrl: string;
	sanitizationKey: string;
	stagingAdminEmail: string;
	stagingAdminPassword: string;
	archivePath: string;
	manifestPath: string;
	keepLocalDatabase: boolean;
};

export type PublishConfig = {
	productionUrl: string;
	stagingUrl: string;
	archivePath: string;
	manifestPath: string;
	resetConfirmation: string;
	stagingGuardToken: string;
};

export type VerifyConfig = {
	productionUrl: string;
	stagingUrl: string;
	manifestPath: string;
};

function requireEnv(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is required`);
	}
	return value;
}

function parseDatabaseUrl(value: string, name: string): URL {
	try {
		const parsed = new URL(value);
		if (
			parsed.protocol !== "postgresql:" &&
			parsed.protocol !== "postgres:"
		) {
			throw new Error("unsupported protocol");
		}
		return parsed;
	} catch {
		throw new Error(`${name} must be a PostgreSQL connection URL`);
	}
}

function directPostgresUrl(value: string, name: string): string {
	const url = parseDatabaseUrl(value, name);
	if (url.port === "6432") {
		url.port = "5432";
	}
	return url.toString();
}

export function databaseIdentity(value: string): string {
	const url = parseDatabaseUrl(value, "database URL");
	const host = url.host || "localhost";
	const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
	const username = decodeURIComponent(url.username);
	const separator = username.lastIndexOf(".");
	const branchId =
		url.hostname.endsWith(".psdb.cloud") && separator > 0
			? username.slice(separator + 1)
			: undefined;
	return `${host}/${database}${branchId ? `@${branchId}` : ""}`;
}

export function assertDifferentDatabases(
	productionUrl: string,
	stagingUrl: string,
): void {
	if (databaseIdentity(productionUrl) === databaseIdentity(stagingUrl)) {
		throw new Error("Production and staging resolve to the same database");
	}
}

function getArtifactPaths(): { archivePath: string; manifestPath: string } {
	const archivePath =
		process.env.SANITIZED_ARCHIVE_PATH?.trim() ||
		join(
			homedir(),
			".local",
			"share",
			"stuwiz",
			"staging-snapshots",
			"staging-sanitized.dump",
		);
	return {
		archivePath,
		manifestPath: `${archivePath}.manifest.json`,
	};
}

export function loadBuildConfig(): BuildConfig {
	const productionUrl = directPostgresUrl(
		requireEnv("PRODUCTION_DATABASE_URL"),
		"PRODUCTION_DATABASE_URL",
	);

	const sanitizationKey = requireEnv("SANITIZATION_KEY");
	if (sanitizationKey.length < 32) {
		throw new Error("SANITIZATION_KEY must contain at least 32 characters");
	}
	const stagingAdminEmail = requireEnv("STAGING_ADMIN_EMAIL").toLowerCase();
	if (
		!stagingAdminEmail.includes("@") ||
		stagingAdminEmail.endsWith("@example.invalid")
	) {
		throw new Error(
			"STAGING_ADMIN_EMAIL must be a deliverable staging-only email",
		);
	}
	const stagingAdminPassword = requireEnv("STAGING_ADMIN_PASSWORD");

	const { archivePath, manifestPath } = getArtifactPaths();
	return {
		productionUrl,
		localAdminUrl:
			process.env.LOCAL_ADMIN_DATABASE_URL?.trim() ||
			"postgresql:///postgres",
		sanitizationKey,
		stagingAdminEmail,
		stagingAdminPassword,
		archivePath,
		manifestPath,
		keepLocalDatabase: process.env.KEEP_SANITIZED_LOCAL_DB === "1",
	};
}

export function loadPublishConfig(): PublishConfig {
	const productionUrl = directPostgresUrl(
		requireEnv("PRODUCTION_DATABASE_URL"),
		"PRODUCTION_DATABASE_URL",
	);
	const stagingUrl = directPostgresUrl(
		requireEnv("STAGING_DATABASE_URL"),
		"STAGING_DATABASE_URL",
	);
	assertDifferentDatabases(productionUrl, stagingUrl);

	const { archivePath, manifestPath } = getArtifactPaths();
	const stagingGuardToken = requireEnv("STAGING_GUARD_TOKEN");
	if (stagingGuardToken.length < 32) {
		throw new Error(
			"STAGING_GUARD_TOKEN must contain at least 32 characters",
		);
	}
	return {
		productionUrl,
		stagingUrl,
		archivePath,
		manifestPath,
		resetConfirmation: requireEnv("STAGING_RESET_CONFIRM"),
		stagingGuardToken,
	};
}

export function loadVerifyConfig(): VerifyConfig {
	const productionUrl = directPostgresUrl(
		requireEnv("PRODUCTION_DATABASE_URL"),
		"PRODUCTION_DATABASE_URL",
	);
	const stagingUrl = directPostgresUrl(
		requireEnv("STAGING_DATABASE_URL"),
		"STAGING_DATABASE_URL",
	);
	assertDifferentDatabases(productionUrl, stagingUrl);
	return {
		productionUrl,
		stagingUrl,
		manifestPath: getArtifactPaths().manifestPath,
	};
}
