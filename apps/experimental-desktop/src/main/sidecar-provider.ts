import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
	compareSemverVersions,
	detectCodexInstallSource,
	fetchLatestCodexVersion,
	getCodexProviderUpdateState,
	resolveCodexManualUpdateCommand,
	resolveCodexUpdateCommand,
	resolveCommandPath,
} from "./sidecar-provider-maintenance";

export type CodexProviderConfig = {
	id: string;
	type: "codex";
	displayName: string;
	binaryPath: string;
	codexHome: string;
	shadowHome?: string;
	env?: Record<string, string>;
};

export type CodexProviderStatus = {
	provider: CodexProviderConfig;
	effectiveCodexHome: string;
	binary: {
		path: string;
		available: boolean;
		version: string | null;
		error: string | null;
		resolvedPath: string | null;
		installSource: CodexInstallSource;
	};
	versionAdvisory?: ProviderVersionAdvisory;
	updateState?: ProviderUpdateState;
};

export type ProviderVersionAdvisoryStatus =
	| "unknown"
	| "current"
	| "behind_latest";

export type ProviderVersionAdvisory = {
	status: ProviderVersionAdvisoryStatus;
	source: CodexInstallSource;
	currentVersion: string | null;
	latestVersion: string | null;
	updateCommand: string | null;
	canUpdate: boolean;
	checkedAt: string | null;
	message: string | null;
};

export type ProviderUpdateStatus =
	| "idle"
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "unchanged";

export type ProviderUpdateState = {
	status: ProviderUpdateStatus;
	startedAt: string | null;
	finishedAt: string | null;
	message: string | null;
	output: string | null;
};

export type CodexInstallSource =
	| "npm"
	| "pnpm"
	| "bun"
	| "brew-cask"
	| "standalone"
	| "windows-standalone"
	| "manual"
	| "unknown";

export function getDefaultCodexProvider(): CodexProviderConfig {
	return {
		id: "codex-default",
		type: "codex",
		displayName: "Codex",
		binaryPath:
			process.env.CODEX_BINARY?.trim() ||
			process.env.CODEX_BIN?.trim() ||
			"codex",
		codexHome: process.env.CODEX_HOME?.trim() || "~/.codex",
		...(process.env.CODEX_SHADOW_HOME?.trim()
			? { shadowHome: process.env.CODEX_SHADOW_HOME.trim() }
			: {}),
	};
}

export function getEffectiveCodexHome(provider: CodexProviderConfig) {
	return expandHomePath(provider.shadowHome ?? provider.codexHome);
}

export function getCodexProviderEnv(provider: CodexProviderConfig) {
	return {
		...process.env,
		...provider.env,
		CODEX_HOME: getEffectiveCodexHome(provider),
	};
}

export async function getCodexProviderStatus(
	provider = getDefaultCodexProvider(),
): Promise<CodexProviderStatus> {
	const version = await runCodexVersion(provider);
	const currentVersion = version.ok
		? parseCodexVersion(version.stdout)
		: null;
	const providerEnv = getCodexProviderEnv(provider);
	const resolvedPath = await resolveCommandPath({
		command: provider.binaryPath,
		env: providerEnv,
		platform: process.platform,
	});
	const installSource = detectCodexInstallSource({
		resolvedPath,
		platform: process.platform,
	});
	const updateCommand = resolveCodexUpdateCommand({
		installSource,
		platform: process.platform,
	});
	const suggestedUpdateCommand = resolveCodexManualUpdateCommand({
		installSource,
		platform: process.platform,
	});
	const latestVersion = version.ok
		? await fetchLatestCodexVersion(installSource)
		: null;
	const checkedAt = new Date().toISOString();
	return {
		provider,
		effectiveCodexHome: getEffectiveCodexHome(provider),
		binary: {
			path: provider.binaryPath,
			available: version.ok,
			version: currentVersion,
			error: version.ok ? null : version.error,
			resolvedPath,
			installSource,
		},
		versionAdvisory: {
			status: getVersionAdvisoryStatus(currentVersion, latestVersion),
			source: installSource,
			currentVersion,
			latestVersion,
			updateCommand:
				updateCommand?.command ??
				suggestedUpdateCommand?.command ??
				null,
			canUpdate: updateCommand !== null,
			checkedAt,
			message: getVersionAdvisoryMessage({
				currentVersion,
				latestVersion,
				canUpdate: updateCommand !== null,
			}),
		},
		updateState: getCodexProviderUpdateState() ?? undefined,
	};
}

export function parseCodexVersion(output: string): string | null {
	const match = output.match(/\b\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?\b/);
	return match?.[0] ?? null;
}

function expandHomePath(path: string) {
	if (path === "~") {
		return homedir();
	}
	if (path.startsWith("~/")) {
		return resolve(homedir(), path.slice(2));
	}
	return resolve(path);
}

function runCodexVersion(provider: CodexProviderConfig) {
	return new Promise<
		{ ok: true; stdout: string } | { ok: false; error: string }
	>((resolveVersion) => {
		const child = spawn(provider.binaryPath, ["--version"], {
			env: getCodexProviderEnv(provider),
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}
			settled = true;
			child.kill();
			resolveVersion({ ok: false, error: "codex --version timed out" });
		}, 5000);

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.once("error", (error) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			resolveVersion({ ok: false, error: error.message });
		});
		child.once("exit", (code) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			const output = stdout.trim();
			if (code === 0 && output) {
				resolveVersion({ ok: true, stdout: output });
				return;
			}
			resolveVersion({
				ok: false,
				error:
					stderr.trim() ||
					output ||
					`codex --version exited with code ${code}`,
			});
		});
	});
}

function getVersionAdvisoryStatus(
	currentVersion: string | null,
	latestVersion: string | null,
): ProviderVersionAdvisoryStatus {
	if (!currentVersion || !latestVersion) {
		return "unknown";
	}
	return compareSemverVersions(currentVersion, latestVersion) < 0
		? "behind_latest"
		: "current";
}

function getVersionAdvisoryMessage(input: {
	currentVersion: string | null;
	latestVersion: string | null;
	canUpdate: boolean;
}) {
	if (!input.currentVersion) {
		return "Codex version could not be detected.";
	}
	if (!input.latestVersion) {
		return "Latest Codex version could not be checked.";
	}
	if (compareSemverVersions(input.currentVersion, input.latestVersion) >= 0) {
		return "Codex is current.";
	}
	return input.canUpdate
		? "Install the update now or review provider settings."
		: "Manual update required.";
}
