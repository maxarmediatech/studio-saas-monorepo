import { spawn } from "node:child_process";
import { createCodexProtocol } from "./sidecar-codex-protocol";
import {
	type CodexProviderConfig,
	getCodexProviderEnv,
	getCodexProviderStatus,
	getDefaultCodexProvider,
	getEffectiveCodexHome,
} from "./sidecar-provider";

type CodexRuntime = {
	provider: CodexProviderConfig;
	initialize: () => Promise<unknown>;
	readAccount: () => Promise<unknown>;
	startThread: () => Promise<string>;
	sendTurn: (input: {
		threadId: string;
		text: string;
		model?: string;
	}) => Promise<unknown>;
	stop: () => Promise<void>;
};

type CodexNotificationListener = (method: string, params: unknown) => void;

export function createCodexAppServerSmokeController() {
	let runtime: CodexRuntime | null = null;
	let runtimeStarting: Promise<CodexRuntime> | null = null;
	const listeners = new Set<CodexNotificationListener>();

	async function ensureRuntime() {
		if (runtime) {
			return runtime;
		}
		runtimeStarting ??= startReusableRuntime(listeners).finally(() => {
			runtimeStarting = null;
		});
		runtime = await runtimeStarting;
		return runtime;
	}

	async function send(input: { text: string; model?: string }) {
		const activeRuntime = await ensureRuntime();
		const threadId = await activeRuntime.startThread();
		let activeTurnId: string | undefined;
		const earlyDeltas: unknown[] = [];
		let cleanup = () => undefined;
		const firstDelta = new Promise<unknown>((resolve, reject) => {
			const timeout = setTimeout(() => {
				cleanup();
				reject(
					new Error(
						"Codex app-server did not emit an assistant delta in time",
					),
				);
			}, 30_000);
			const listener: CodexNotificationListener = (method, params) => {
				if (method === "item/agentMessage/delta") {
					if (!activeTurnId) {
						earlyDeltas.push(params);
						return;
					}
					if (readNotificationTurnId(params) !== activeTurnId) {
						return;
					}
					clearTimeout(timeout);
					cleanup();
					resolve(params);
				}
				if (method === "turn/completed" && isFailedTurn(params)) {
					if (
						activeTurnId &&
						readNotificationTurnId(params) !== activeTurnId
					) {
						return;
					}
					clearTimeout(timeout);
					cleanup();
					reject(new Error(readTurnError(params)));
				}
				if (method === "error") {
					clearTimeout(timeout);
					cleanup();
					reject(new Error(readErrorMessage(params)));
				}
			};
			cleanup = () => {
				clearTimeout(timeout);
				listeners.delete(listener);
			};
			listeners.add(listener);
		});
		const turn = await activeRuntime.sendTurn({
			threadId,
			text: input.text,
			model: input.model ?? "gpt-5.4-mini",
		});
		activeTurnId = readTurnId(turn);
		if (activeTurnId) {
			const earlyDelta = earlyDeltas.find(
				(delta) => readNotificationTurnId(delta) === activeTurnId,
			);
			if (earlyDelta) {
				cleanup();
				return {
					ok: true,
					threadId,
					turn,
					firstDelta: earlyDelta,
				};
			}
		}
		const delta = await firstDelta;
		return {
			ok: true,
			threadId,
			turn,
			firstDelta: delta,
		};
	}

	async function stop() {
		const activeRuntime = runtime;
		runtime = null;
		runtimeStarting = null;
		listeners.clear();
		await activeRuntime?.stop();
	}

	return { send, stop };
}

export async function probeCodexAppServer(
	provider = getDefaultCodexProvider(),
) {
	const status = await getCodexProviderStatus(provider);
	if (!status.binary.available) {
		throw new Error(
			`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
		);
	}
	const runtime = startCodexRuntime(provider, {
		autoAnswerUserInput: true,
	});
	try {
		const initialized = await runtime.initialize();
		const account = await runtime.readAccount();
		return {
			ok: true,
			provider: {
				id: provider.id,
				displayName: provider.displayName,
				binaryPath: provider.binaryPath,
				codexHome: provider.codexHome,
				shadowHome: provider.shadowHome ?? null,
				effectiveCodexHome: getEffectiveCodexHome(provider),
			},
			initialized,
			account,
		};
	} finally {
		await runtime.stop();
	}
}

async function startReusableRuntime(listeners: Set<CodexNotificationListener>) {
	const provider = getDefaultCodexProvider();
	const status = await getCodexProviderStatus(provider);
	if (!status.binary.available) {
		throw new Error(
			`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
		);
	}
	const runtime = startCodexRuntime(provider, {
		onNotification: (method, params) => {
			for (const listener of listeners) {
				listener(method, params);
			}
		},
	});
	try {
		await runtime.initialize();
		return runtime;
	} catch (error) {
		await runtime.stop();
		throw error;
	}
}

export async function sendCodexAppServerSmokeTest(input: {
	text: string;
	model?: string;
	provider?: CodexProviderConfig;
}) {
	const provider = input.provider ?? getDefaultCodexProvider();
	const status = await getCodexProviderStatus(provider);
	if (!status.binary.available) {
		throw new Error(
			`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
		);
	}

	let resolveFirstDelta: (value: unknown) => void = () => undefined;
	let rejectFirstDelta: (error: Error) => void = () => undefined;
	const firstDelta = new Promise<unknown>((resolve, reject) => {
		resolveFirstDelta = resolve;
		rejectFirstDelta = reject;
	});
	const timeout = setTimeout(() => {
		rejectFirstDelta(
			new Error(
				"Codex app-server did not emit an assistant delta in time",
			),
		);
	}, 30_000);

	const runtime = startCodexRuntime(provider, {
		onNotification: (method, params) => {
			if (method === "item/agentMessage/delta") {
				clearTimeout(timeout);
				resolveFirstDelta(params);
			}
			if (method === "turn/completed" && isFailedTurn(params)) {
				clearTimeout(timeout);
				rejectFirstDelta(new Error(readTurnError(params)));
			}
			if (method === "error") {
				clearTimeout(timeout);
				rejectFirstDelta(new Error(readErrorMessage(params)));
			}
		},
	});
	try {
		await runtime.initialize();
		const threadId = await runtime.startThread();
		const turn = await runtime.sendTurn({
			threadId,
			text: input.text,
			model: input.model ?? "gpt-5.4-mini",
		});
		const delta = await firstDelta;
		return {
			ok: true,
			provider: {
				id: provider.id,
				displayName: provider.displayName,
				binaryPath: provider.binaryPath,
				codexHome: provider.codexHome,
				shadowHome: provider.shadowHome ?? null,
				effectiveCodexHome: getEffectiveCodexHome(provider),
			},
			threadId,
			turn,
			firstDelta: delta,
		};
	} finally {
		clearTimeout(timeout);
		await runtime.stop();
	}
}

function startCodexRuntime(
	provider: CodexProviderConfig,
	options: {
		autoAnswerUserInput?: boolean;
		onNotification?: (method: string, params: unknown) => void;
	} = {},
): CodexRuntime {
	const child = spawn(provider.binaryPath, ["app-server"], {
		cwd: process.cwd(),
		env: getCodexProviderEnv(provider),
		stdio: "pipe",
	});
	const protocol = createCodexProtocol(child, {
		autoAnswerUserInput: options.autoAnswerUserInput ?? false,
		requestTimeoutMs: 30_000,
		onStderr: (text) => {
			const trimmed = text.trimEnd();
			if (trimmed) {
				console.warn(`[codex app-server] ${trimmed}`);
			}
		},
		onNotification: (method, params) => {
			options.onNotification?.(method, params);
			console.log(
				`[codex app-server] notification ${method} ${JSON.stringify(params ?? {}).slice(0, 500)}`,
			);
		},
	});
	let stopped = false;

	async function initialize() {
		const initialized = await protocol.request("initialize", {
			clientInfo: {
				name: "experimental-desktop",
				title: "Experimental Desktop",
				version: "0.0.0",
			},
			capabilities: {
				experimentalApi: true,
				optOutNotificationMethods: null,
			},
		});
		protocol.notify("initialized");
		return initialized;
	}

	function readAccount() {
		return protocol.request("account/read", {});
	}

	async function startThread() {
		const response = await protocol.request("thread/start", {
			cwd: process.cwd(),
			approvalPolicy: "never",
			sandbox: "read-only",
			model: "gpt-5.4-mini",
		});
		const threadId = readThreadId(response);
		if (!threadId) {
			throw new Error("Codex app-server did not return a thread id");
		}
		return threadId;
	}

	function sendTurn(input: {
		threadId: string;
		text: string;
		model?: string;
	}) {
		return protocol.request("turn/start", {
			threadId: input.threadId,
			input: [{ type: "text", text: input.text }],
			approvalPolicy: "never",
			sandboxPolicy: { type: "readOnly" },
			model: input.model ?? "gpt-5.4-mini",
		});
	}

	async function stop() {
		if (stopped) {
			return;
		}
		stopped = true;
		protocol.stop();
		await new Promise<void>((resolve) => {
			if (child.exitCode !== null || child.signalCode !== null) {
				resolve();
				return;
			}
			const timeout = setTimeout(() => {
				child.kill("SIGKILL");
				resolve();
			}, 2000);
			child.once("exit", () => {
				clearTimeout(timeout);
				resolve();
			});
			child.kill();
		});
	}

	return { provider, initialize, readAccount, startThread, sendTurn, stop };
}

function readThreadId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	const thread = value.thread;
	if (isRecord(thread) && typeof thread.id === "string") {
		return thread.id;
	}
	if (typeof value.threadId === "string") {
		return value.threadId;
	}
	return undefined;
}

function readTurnId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	const turn = value.turn;
	if (isRecord(turn) && typeof turn.id === "string") {
		return turn.id;
	}
	if (typeof value.turnId === "string") {
		return value.turnId;
	}
	return undefined;
}

function readNotificationTurnId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	if (typeof value.turnId === "string") {
		return value.turnId;
	}
	const turn = value.turn;
	if (isRecord(turn) && typeof turn.id === "string") {
		return turn.id;
	}
	return undefined;
}

function isFailedTurn(value: unknown) {
	if (!isRecord(value) || !isRecord(value.turn)) {
		return false;
	}
	return value.turn.status === "failed";
}

function readTurnError(value: unknown) {
	if (!isRecord(value) || !isRecord(value.turn)) {
		return "Codex turn failed";
	}
	const error = value.turn.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex turn failed";
}

function readErrorMessage(value: unknown) {
	if (!isRecord(value)) {
		return "Codex app-server error";
	}
	const error = value.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex app-server error";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
