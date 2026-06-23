import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath } from "node:fs/promises";
import { delimiter, isAbsolute, join, normalize } from "node:path";
import type {
	CodexInstallSource,
	CodexProviderStatus,
	ProviderUpdateState,
} from "./sidecar-provider";

const CODEX_NPM_PACKAGE = "@openai/codex";
const CODEX_NPM_LATEST_URL =
	"https://registry.npmjs.org/@openai%2Fcodex/latest";
const CODEX_GITHUB_RELEASE_LATEST_URL =
	"https://api.github.com/repos/openai/codex/releases/latest";
const LATEST_VERSION_CACHE_TTL_MS = 60 * 60 * 1000;
const LATEST_VERSION_TIMEOUT_MS = 4000;
const UPDATE_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_OUTPUT_BYTES = 10 * 1024;

type LatestVersionChannel = "npm" | "github";

type CachedLatestVersion = {
	version: string | null;
	checkedAt: number;
};

export type ProviderUpdateCommand = {
	command: string;
	executable: string;
	args: Array<string>;
	// Reserved for future multi-provider/package-manager update serialization.
	lockKey: string;
};

const latestVersionCache = new Map<LatestVersionChannel, CachedLatestVersion>();
let codexUpdateState: ProviderUpdateState | null = null;
let updateInFlight: Promise<CodexProviderStatus> | null = null;

export function getCodexProviderUpdateState() {
	return codexUpdateState;
}

export async function resolveCommandPath(input: {
	command: string;
	env?: NodeJS.ProcessEnv;
	platform?: NodeJS.Platform;
}): Promise<string | null> {
	const platform = input.platform ?? process.platform;
	const env = input.env ?? process.env;
	const trimmed = input.command.trim();
	if (!trimmed) {
		return null;
	}
	if (hasPathSeparator(trimmed)) {
		return realpathIfExecutable(trimmed, platform);
	}
	const resolved = await findOnPath({
		command: trimmed,
		env,
		platform,
	});
	if (resolved) {
		return resolved;
	}
	if (platform === "win32") {
		return firstWhereResult(trimmed, platform);
	}
	return null;
}

export function detectCodexInstallSource(input: {
	resolvedPath: string | null;
	platform: NodeJS.Platform;
}): CodexInstallSource {
	if (!input.resolvedPath) {
		return "unknown";
	}
	const path = normalize(input.resolvedPath).replaceAll("\\", "/");
	const lower = path.toLowerCase();

	if (input.platform === "win32") {
		if (lower.includes("/appdata/roaming/npm/")) {
			return "npm";
		}
		if (lower.includes("/appdata/local/pnpm/")) {
			return "pnpm";
		}
		if (
			lower.includes("/.bun/bin/") ||
			lower.includes("/.bun/install/global/node_modules/")
		) {
			return "bun";
		}
		if (
			lower.includes("/appdata/local/programs/codex/") ||
			lower.includes("/appdata/local/codex/") ||
			lower.includes("/program files/codex/")
		) {
			return "windows-standalone";
		}
		return lower.endsWith(".exe") || lower.endsWith(".cmd")
			? "manual"
			: "unknown";
	}

	if (lower.includes("/.local/share/pnpm/")) {
		return "pnpm";
	}
	if (
		lower.includes("/.bun/bin/") ||
		lower.includes("/.bun/install/global/node_modules/")
	) {
		return "bun";
	}
	if (lower.includes("/node_modules/.bin/")) {
		return "npm";
	}
	if (lower.includes("/lib/node_modules/")) {
		return "npm";
	}
	if (
		lower.includes("/opt/homebrew/") ||
		lower.includes("/usr/local/cellar/")
	) {
		return "brew-cask";
	}
	if (
		lower.includes("/.local/bin/codex") ||
		lower.includes("/usr/local/bin/codex") ||
		lower.includes("/usr/bin/codex")
	) {
		return "standalone";
	}
	return "manual";
}

export async function fetchLatestCodexVersion(
	installSource: CodexInstallSource = "npm",
): Promise<string | null> {
	const channel = getLatestVersionChannel(installSource);
	const cached = latestVersionCache.get(channel);
	const now = Date.now();
	if (cached && now - cached.checkedAt < LATEST_VERSION_CACHE_TTL_MS) {
		return cached.version;
	}
	const version =
		channel === "npm"
			? await fetchLatestNpmVersion()
			: await fetchLatestGithubVersion();
	latestVersionCache.set(channel, { version, checkedAt: now });
	return version;
}

export function compareSemverVersions(left: string, right: string): number {
	const parsedLeft = parseSemver(left);
	const parsedRight = parseSemver(right);
	if (!parsedLeft || !parsedRight) {
		return left.localeCompare(right);
	}
	for (const key of ["major", "minor", "patch"] as const) {
		const delta = parsedLeft[key] - parsedRight[key];
		if (delta < 0) {
			return -1;
		}
		if (delta > 0) {
			return 1;
		}
	}
	return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease);
}

export function resolveCodexUpdateCommand(input: {
	installSource: CodexInstallSource;
	platform: NodeJS.Platform;
}): ProviderUpdateCommand | null {
	if (input.installSource === "npm") {
		return toUpdateCommand(
			"npm",
			["install", "-g", `${CODEX_NPM_PACKAGE}@latest`],
			"npm-global",
		);
	}
	if (input.installSource === "pnpm") {
		return toUpdateCommand(
			"pnpm",
			["add", "-g", `${CODEX_NPM_PACKAGE}@latest`],
			"pnpm-global",
		);
	}
	if (input.installSource === "bun") {
		return toUpdateCommand(
			"bun",
			["i", "-g", `${CODEX_NPM_PACKAGE}@latest`],
			"bun-global",
		);
	}
	if (input.installSource === "brew-cask") {
		return toUpdateCommand(
			"brew",
			["upgrade", "--cask", "codex"],
			"homebrew-cask",
		);
	}
	if (
		input.installSource === "windows-standalone" &&
		input.platform === "win32"
	) {
		return toUpdateCommand(
			"powershell.exe",
			[
				"-ExecutionPolicy",
				"ByPass",
				"-c",
				"irm https://chatgpt.com/codex/install.ps1 | iex",
			],
			"codex-windows-standalone",
		);
	}
	if (input.installSource === "standalone" && input.platform !== "win32") {
		return toUpdateCommand(
			"sh",
			["-c", "curl -fsSL https://chatgpt.com/codex/install.sh | sh"],
			"codex-standalone",
		);
	}
	return null;
}

export function resolveCodexManualUpdateCommand(input: {
	installSource: CodexInstallSource;
	platform: NodeJS.Platform;
}): ProviderUpdateCommand | null {
	if (input.installSource !== "manual" && input.installSource !== "unknown") {
		return null;
	}
	if (input.platform === "win32") {
		return toUpdateCommand(
			"powershell.exe",
			[
				"-ExecutionPolicy",
				"ByPass",
				"-c",
				"irm https://chatgpt.com/codex/install.ps1 | iex",
			],
			"codex-manual-windows",
		);
	}
	return toUpdateCommand(
		"sh",
		["-c", "curl -fsSL https://chatgpt.com/codex/install.sh | sh"],
		"codex-manual-standalone",
	);
}

export async function runProviderUpdateCommand(
	command: ProviderUpdateCommand,
): Promise<{
	stdout: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
}> {
	return new Promise((resolve) => {
		const child = spawn(command.executable, command.args, {
			stdio: ["ignore", "pipe", "pipe"],
			shell: false,
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		let timedOut = false;
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}
			timedOut = true;
			child.kill();
			setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				resolve({
					stdout,
					stderr,
					exitCode: null,
					timedOut: true,
				});
			}, 2000);
		}, UPDATE_TIMEOUT_MS);

		child.stdout.on("data", (chunk: Buffer) => {
			stdout = appendLimited(stdout, chunk.toString("utf8"));
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = appendLimited(stderr, chunk.toString("utf8"));
		});
		child.once("error", (error) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			resolve({
				stdout,
				stderr: appendLimited(stderr, error.message),
				exitCode: null,
				timedOut,
			});
		});
		child.once("exit", (code) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			resolve({ stdout, stderr, exitCode: code, timedOut });
		});
	});
}

export async function updateCodexProvider(input: {
	stopCodexRuntime: () => Promise<void>;
	getStatus: () => Promise<CodexProviderStatus>;
}): Promise<CodexProviderStatus> {
	if (updateInFlight) {
		const status = await input.getStatus();
		return {
			...status,
			updateState: codexUpdateState ?? {
				status: "running",
				startedAt: new Date().toISOString(),
				finishedAt: null,
				message: "Codex update already running.",
				output: null,
			},
		};
	}
	updateInFlight = runCodexProviderUpdate(input).finally(() => {
		updateInFlight = null;
	});
	return updateInFlight;
}

async function runCodexProviderUpdate(input: {
	stopCodexRuntime: () => Promise<void>;
	getStatus: () => Promise<CodexProviderStatus>;
}) {
	const currentStatus = await input.getStatus();
	const command = resolveCodexUpdateCommand({
		installSource: currentStatus.binary.installSource,
		platform: process.platform,
	});
	const startedAt = new Date().toISOString();
	if (!command) {
		codexUpdateState = {
			status: "failed",
			startedAt,
			finishedAt: new Date().toISOString(),
			message: "This Codex install does not support one-click updates.",
			output: null,
		};
		return { ...currentStatus, updateState: codexUpdateState };
	}

	codexUpdateState = {
		status: "running",
		startedAt,
		finishedAt: null,
		message: `Running ${command.command}`,
		output: null,
	};
	await input.stopCodexRuntime();
	const result = await runProviderUpdateCommand(command);
	const output = [result.stdout.trim(), result.stderr.trim()]
		.filter(Boolean)
		.join("\n");
	if (result.exitCode !== 0 || result.timedOut) {
		codexUpdateState = {
			status: "failed",
			startedAt,
			finishedAt: new Date().toISOString(),
			message: result.timedOut
				? "Codex update timed out."
				: `Codex update exited with code ${result.exitCode ?? "unknown"}.`,
			output,
		};
		return { ...(await input.getStatus()), updateState: codexUpdateState };
	}

	const newStatus = await input.getStatus();
	const advisoryStatus = newStatus.versionAdvisory?.status;
	codexUpdateState = {
		status: advisoryStatus === "behind_latest" ? "unchanged" : "succeeded",
		startedAt,
		finishedAt: new Date().toISOString(),
		message:
			advisoryStatus === "behind_latest"
				? "Codex update finished, but the installed version is still behind latest."
				: "Codex updated.",
		output,
	};
	return { ...newStatus, updateState: codexUpdateState };
}

function getLatestVersionChannel(
	installSource: CodexInstallSource,
): LatestVersionChannel {
	return installSource === "npm" ||
		installSource === "pnpm" ||
		installSource === "bun"
		? "npm"
		: "github";
}

async function fetchLatestNpmVersion() {
	const payload = await fetchJsonWithTimeout(CODEX_NPM_LATEST_URL);
	return readVersionField(payload);
}

async function fetchLatestGithubVersion() {
	const payload = await fetchJsonWithTimeout(CODEX_GITHUB_RELEASE_LATEST_URL);
	return readVersionField(payload) ?? readTagVersion(payload);
}

async function fetchJsonWithTimeout(url: string) {
	const controller = new AbortController();
	const timeout = setTimeout(
		() => controller.abort(),
		LATEST_VERSION_TIMEOUT_MS,
	);
	try {
		const response = await fetch(url, {
			headers: { accept: "application/json" },
			signal: controller.signal,
		});
		if (!response.ok) {
			return null;
		}
		return response.json();
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function readVersionField(value: unknown) {
	if (!isRecord(value) || typeof value.version !== "string") {
		return null;
	}
	return parseVersion(value.version);
}

function readTagVersion(value: unknown) {
	if (!isRecord(value) || typeof value.tag_name !== "string") {
		return null;
	}
	return parseVersion(value.tag_name);
}

function parseVersion(value: string) {
	const match = value.match(/\b\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?\b/);
	return match?.[0] ?? null;
}

function parseSemver(version: string) {
	const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?/);
	if (!match) {
		return null;
	}
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] ?? null,
	};
}

function comparePrerelease(left: string | null, right: string | null) {
	if (!left && !right) {
		return 0;
	}
	if (!left) {
		return 1;
	}
	if (!right) {
		return -1;
	}
	const leftParts = left.split(".");
	const rightParts = right.split(".");
	const length = Math.max(leftParts.length, rightParts.length);
	for (let index = 0; index < length; index += 1) {
		const leftPart = leftParts[index];
		const rightPart = rightParts[index];
		if (leftPart === undefined) {
			return -1;
		}
		if (rightPart === undefined) {
			return 1;
		}
		const leftNumber = Number(leftPart);
		const rightNumber = Number(rightPart);
		const bothNumeric =
			!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
		const delta = bothNumeric
			? leftNumber - rightNumber
			: leftPart.localeCompare(rightPart);
		if (delta < 0) {
			return -1;
		}
		if (delta > 0) {
			return 1;
		}
	}
	return 0;
}

async function findOnPath(input: {
	command: string;
	env: NodeJS.ProcessEnv;
	platform: NodeJS.Platform;
}) {
	const pathValue = readPathEnv(input.env);
	if (!pathValue) {
		return null;
	}
	const extensions = getPathExtensions(input.env, input.platform);
	for (const directory of pathValue.split(delimiter)) {
		if (!directory) {
			continue;
		}
		for (const extension of extensions) {
			const candidate = join(directory, `${input.command}${extension}`);
			const resolved = await realpathIfExecutable(
				candidate,
				input.platform,
			);
			if (resolved) {
				return resolved;
			}
		}
	}
	return null;
}

function readPathEnv(env: NodeJS.ProcessEnv) {
	return env.Path ?? env.PATH ?? env.path ?? "";
}

function getPathExtensions(env: NodeJS.ProcessEnv, platform: NodeJS.Platform) {
	if (platform !== "win32") {
		return [""];
	}
	const pathExt = env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
	const extensions = pathExt
		.split(";")
		.map((extension) => extension.trim())
		.filter(Boolean);
	return ["", ...extensions];
}

async function realpathIfExecutable(path: string, platform: NodeJS.Platform) {
	try {
		await access(
			path,
			platform === "win32" ? constants.F_OK : constants.X_OK,
		);
		return realpath(path);
	} catch {
		return null;
	}
}

async function firstWhereResult(command: string, platform: NodeJS.Platform) {
	const result = await runShortCommand("where.exe", [command]);
	const first = result.stdout
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	return first ? realpathIfExecutable(first, platform) : null;
}

function runShortCommand(executable: string, args: string[]) {
	return new Promise<{ stdout: string; stderr: string }>((resolve) => {
		const child = spawn(executable, args, {
			stdio: ["ignore", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		let settled = false;
		const finish = () => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			resolve({ stdout, stderr });
		};
		const timeout = setTimeout(() => {
			child.kill();
			setTimeout(finish, 2000);
		}, 3000);
		child.stdout.on("data", (chunk: Buffer) => {
			stdout = appendLimited(stdout, chunk.toString("utf8"));
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr = appendLimited(stderr, chunk.toString("utf8"));
		});
		child.once("error", finish);
		child.once("exit", finish);
	});
}

function hasPathSeparator(value: string) {
	return value.includes("/") || value.includes("\\") || isAbsolute(value);
}

function toUpdateCommand(
	executable: string,
	args: string[],
	lockKey: string,
): ProviderUpdateCommand {
	return {
		command: [executable, ...args].join(" "),
		executable,
		args,
		lockKey,
	};
}

function appendLimited(current: string, next: string) {
	const combined = current + next;
	return Buffer.byteLength(combined, "utf8") <= MAX_OUTPUT_BYTES
		? combined
		: combined.slice(-MAX_OUTPUT_BYTES);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
