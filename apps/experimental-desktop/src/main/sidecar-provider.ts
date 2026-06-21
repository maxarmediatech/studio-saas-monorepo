import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";

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
	};
};

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
	return {
		provider,
		effectiveCodexHome: getEffectiveCodexHome(provider),
		binary: {
			path: provider.binaryPath,
			available: version.ok,
			version: version.ok ? version.stdout : null,
			error: version.ok ? null : version.error,
		},
	};
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
