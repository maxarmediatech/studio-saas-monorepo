import { spawn } from "node:child_process";
import { homedir } from "node:os";
import {
	type CodexIncomingRequest,
	createCodexProtocol,
} from "./sidecar-codex-protocol";
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
	startThread: (input?: {
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<string>;
	sendTurn: (input: {
		threadId: string;
		text: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<unknown>;
	stop: () => Promise<void>;
};

export type CodexRuntimeMode = "read-only" | "workspace-write" | "full-access";

type CodexRuntimeListener = (event: CodexRuntimeEvent) => void;

export type CodexRuntimeEvent =
	| {
			kind: "notification";
			method: string;
			params: unknown;
	  }
	| {
			kind: "request";
			requestId: string;
			method: string;
			params: unknown;
	  }
	| {
			kind: "request.timeout";
			requestId: string;
			method: string;
			params: unknown;
	  };

type PendingRuntimeRequest = {
	method: string;
	params: unknown;
	timeout: NodeJS.Timeout;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
};

export type CodexSessionRuntime = {
	ensure: () => Promise<void>;
	createThread: (input?: {
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<{ threadId: string }>;
	sendTurn: (input: {
		threadId: string;
		text: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<{ turnId?: string; raw: unknown }>;
	subscribe: (listener: (event: CodexRuntimeEvent) => void) => () => void;
	respondToRequest: (input: {
		requestId: string;
		response: unknown;
	}) => Promise<void>;
	stop: () => Promise<void>;
};

export function createCodexSessionRuntime(): CodexSessionRuntime {
	let runtime: CodexRuntime | null = null;
	let runtimeStarting: Promise<CodexRuntime> | null = null;
	const listeners = new Set<CodexRuntimeListener>();
	const pendingRequests = new Map<string, PendingRuntimeRequest>();

	async function ensureRuntime() {
		if (runtime) {
			return runtime;
		}
		runtimeStarting ??= startReusableRuntime(
			listeners,
			pendingRequests,
		).finally(() => {
			runtimeStarting = null;
		});
		runtime = await runtimeStarting;
		return runtime;
	}

	async function ensure() {
		await ensureRuntime();
	}

	async function createThread(input?: {
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) {
		const activeRuntime = await ensureRuntime();
		return {
			threadId: await activeRuntime.startThread(input),
		};
	}

	async function sendTurn(input: {
		threadId: string;
		text: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) {
		const activeRuntime = await ensureRuntime();
		const raw = await activeRuntime.sendTurn(input);
		return { turnId: readTurnId(raw), raw };
	}

	function subscribe(listener: (event: CodexRuntimeEvent) => void) {
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}

	async function respondToRequest(input: {
		requestId: string;
		response: unknown;
	}) {
		const pending = pendingRequests.get(input.requestId);
		if (!pending) {
			throw new Error(
				`Unknown pending Codex request: ${input.requestId}`,
			);
		}
		pendingRequests.delete(input.requestId);
		clearTimeout(pending.timeout);
		pending.resolve(input.response);
	}

	async function stop() {
		const activeRuntime = runtime;
		runtime = null;
		runtimeStarting = null;
		listeners.clear();
		for (const [requestId, request] of pendingRequests) {
			clearTimeout(request.timeout);
			request.reject(
				new Error(`Codex app-server stopped before ${request.method}`),
			);
			pendingRequests.delete(requestId);
		}
		await activeRuntime?.stop();
	}

	return {
		ensure,
		createThread,
		sendTurn,
		subscribe,
		respondToRequest,
		stop,
	};
}

export function createCodexAppServerSmokeController(
	runtime = createCodexSessionRuntime(),
) {
	async function send(input: { text: string; model?: string }) {
		const { threadId } = await runtime.createThread({
			model: input.model ?? "gpt-5.4-mini",
		});
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
			const unsubscribe = runtime.subscribe((event) => {
				if (event.method === "item/agentMessage/delta") {
					if (!activeTurnId) {
						earlyDeltas.push(event.params);
						return;
					}
					if (readNotificationTurnId(event.params) !== activeTurnId) {
						return;
					}
					clearTimeout(timeout);
					cleanup();
					resolve(event.params);
				}
				if (
					event.method === "turn/completed" &&
					isFailedTurn(event.params)
				) {
					if (
						activeTurnId &&
						readNotificationTurnId(event.params) !== activeTurnId
					) {
						return;
					}
					clearTimeout(timeout);
					cleanup();
					reject(new Error(readTurnError(event.params)));
				}
				if (event.method === "error") {
					clearTimeout(timeout);
					cleanup();
					reject(new Error(readErrorMessage(event.params)));
				}
			});
			cleanup = () => {
				clearTimeout(timeout);
				unsubscribe();
			};
		});
		const turn = await runtime.sendTurn({
			threadId,
			text: input.text,
			model: input.model ?? "gpt-5.4-mini",
		});
		activeTurnId = turn.turnId;
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
		await runtime.stop();
	}

	return { send, stop };
}

let probeInFlight: Promise<
	Awaited<ReturnType<typeof runCodexAppServerProbe>>
> | null = null;

export async function probeCodexAppServer(
	provider = getDefaultCodexProvider(),
) {
	probeInFlight ??= runCodexAppServerProbe(provider).finally(() => {
		probeInFlight = null;
	});
	return probeInFlight;
}

async function runCodexAppServerProbe(provider: CodexProviderConfig) {
	const status = await getCodexProviderStatus(provider);
	if (!status.binary.available) {
		throw new Error(
			`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
		);
	}
	const runtime = startCodexRuntime(provider, {
		// Probe only: user-input prompts are answered automatically so the
		// readiness check cannot hang on an interactive app-server request.
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

async function startReusableRuntime(
	listeners: Set<CodexRuntimeListener>,
	pendingRequests: Map<string, PendingRuntimeRequest>,
) {
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
				listener({ kind: "notification", method, params });
			}
		},
		onRequest: (request) =>
			new Promise((resolve, reject) => {
				const requestId = randomRequestId();
				const timeout = setTimeout(
					() => {
						pendingRequests.delete(requestId);
						for (const listener of listeners) {
							listener({
								kind: "request.timeout",
								requestId,
								method: request.method,
								params: request.params,
							});
						}
						reject(
							new Error(
								`Codex request timed out waiting for response: ${request.method}`,
							),
						);
					},
					5 * 60 * 1000,
				);
				pendingRequests.set(requestId, {
					method: request.method,
					params: request.params,
					timeout,
					resolve,
					reject,
				});
				for (const listener of listeners) {
					listener({
						kind: "request",
						requestId,
						method: request.method,
						params: request.params,
					});
				}
			}),
	});
	try {
		await runtime.initialize();
		return runtime;
	} catch (error) {
		await runtime.stop();
		throw error;
	}
}

function startCodexRuntime(
	provider: CodexProviderConfig,
	options: {
		autoAnswerUserInput?: boolean;
		onNotification?: (method: string, params: unknown) => void;
		onRequest?: (
			request: CodexIncomingRequest,
		) => Promise<unknown> | unknown;
	} = {},
): CodexRuntime {
	if (options.autoAnswerUserInput && options.onRequest) {
		throw new Error(
			"autoAnswerUserInput is probe-only and cannot be used with session request handling",
		);
	}
	const child = spawn(
		provider.binaryPath,
		[
			"app-server",
			"-c",
			"sandbox_workspace_write.exclude_slash_tmp=true",
			"-c",
			"sandbox_workspace_write.exclude_tmpdir_env_var=true",
		],
		{
			cwd: homedir(),
			env: getCodexProviderEnv(provider),
			stdio: "pipe",
		},
	);
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
		...(options.onRequest
			? {
					onRequest: (request: CodexIncomingRequest) => {
						console.log(
							`[codex app-server] request ${request.method} ${JSON.stringify(request.params ?? {}).slice(0, 500)}`,
						);
						return options.onRequest?.(request);
					},
				}
			: {}),
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

	async function startThread(input?: {
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) {
		const cwd = input?.cwd ?? homedir();
		const config = runtimeModeToCodexConfig(
			input?.runtimeMode ?? "read-only",
			cwd,
		);
		const response = await protocol.request("thread/start", {
			cwd,
			approvalPolicy: config.approvalPolicy,
			sandbox: config.sandbox,
			...(config.threadSandboxPolicy
				? { sandboxPolicy: config.threadSandboxPolicy }
				: {}),
			model: input?.model ?? "gpt-5.4-mini",
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
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) {
		const cwd = input.cwd ?? homedir();
		const config = runtimeModeToCodexConfig(
			input.runtimeMode ?? "read-only",
			cwd,
		);
		return protocol.request(
			"turn/start",
			{
				threadId: input.threadId,
				input: [{ type: "text", text: input.text }],
				cwd,
				approvalPolicy: config.approvalPolicy,
				sandboxPolicy: config.turnSandboxPolicy,
				model: input.model ?? "gpt-5.4-mini",
			},
			{ timeoutMs: 5 * 60 * 1000 },
		);
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

function runtimeModeToCodexConfig(mode: CodexRuntimeMode, cwd: string) {
	if (mode === "full-access") {
		return {
			approvalPolicy: "never",
			sandbox: "danger-full-access",
			turnSandboxPolicy: { type: "dangerFullAccess" },
		};
	}
	if (mode === "workspace-write") {
		return {
			approvalPolicy: "on-request",
			sandbox: "workspace-write",
			threadSandboxPolicy: {
				type: "workspaceWrite",
				writableRoots: [cwd],
			},
			turnSandboxPolicy: {
				type: "workspaceWrite",
				writableRoots: [cwd],
			},
		};
	}
	return {
		approvalPolicy: "untrusted",
		sandbox: "read-only",
		turnSandboxPolicy: { type: "readOnly" },
	};
}

function randomRequestId() {
	return `codex-request-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
