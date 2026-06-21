import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, safeStorage, utilityProcess } from "electron";

const currentDir = dirname(fileURLToPath(import.meta.url));
const authStore = createMainOpenAiAuthStore();

export type SidecarRuntime = {
	url: string;
	username: string;
	password: string;
	stop: () => Promise<void>;
};

type SidecarMessage =
	| { type: "ready" }
	| { type: "stopped" }
	| { type: "error"; error: { message: string; stack?: string } };

type StoredOpenAiAuth = {
	type: "oauth";
	provider: "openai";
	access: string;
	refresh: string;
	expires: number;
	accountId?: string;
	updatedAt: string;
};

type AuthStorageRequest =
	| { type: "auth-storage:request"; id: string; operation: "read" }
	| {
			type: "auth-storage:request";
			id: string;
			operation: "write";
			auth: StoredOpenAiAuth | null;
	  };

type StoredAuthEnvelope = {
	encoding: "electron-safe-storage";
	data: string;
	updatedAt: string;
};

export type SidecarManager = {
	ensure: () => Promise<SidecarRuntime>;
	fetch: (
		runtime: SidecarRuntime,
		path: string,
		init?: RequestInit,
	) => Promise<unknown>;
	stop: () => Promise<void>;
};

export function createSidecarManager(): SidecarManager {
	let sidecar: SidecarRuntime | null = null;
	let sidecarStarting: Promise<SidecarRuntime> | null = null;
	let startingChild: ReturnType<typeof utilityProcess.fork> | null = null;
	let stopRequested = false;

	async function ensure() {
		stopRequested = false;
		if (sidecar) {
			return sidecar;
		}
		sidecarStarting ??= spawnSidecar().finally(() => {
			sidecarStarting = null;
		});
		const runtime = await sidecarStarting;
		if (stopRequested) {
			await runtime.stop();
			throw new Error("Sidecar startup was canceled");
		}
		sidecar = runtime;
		return runtime;
	}

	async function stop() {
		stopRequested = true;
		if (sidecar) {
			await sidecar.stop();
		} else if (startingChild) {
			startingChild.kill();
			await sidecarStarting?.catch(() => undefined);
		}
		sidecar = null;
		sidecarStarting = null;
		startingChild = null;
	}

	async function spawnSidecar(): Promise<SidecarRuntime> {
		const port = await getFreePort();
		const hostname = "127.0.0.1";
		const username = "experimental";
		const password = randomUUID();
		const url = `http://${hostname}:${port}`;
		const sidecarPath = join(currentDir, "sidecar.js");
		const child = utilityProcess.fork(sidecarPath, [], {
			serviceName: "experimental desktop sidecar",
			stdio: "pipe",
		});
		startingChild = child;

		child.stdout?.on("data", (chunk: Buffer) => {
			console.log(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			console.warn(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
		});
		child.on("message", (message: unknown) => {
			void handleSidecarRuntimeMessage(child, message);
		});

		await new Promise<void>((resolve, reject) => {
			let settled = false;
			const timeout = setTimeout(() => {
				if (settled) {
					return;
				}
				settled = true;
				cleanup();
				child.kill();
				reject(new Error("Sidecar did not start within 30 seconds"));
			}, 30_000);

			const cleanup = () => {
				clearTimeout(timeout);
				child.off("message", onMessage);
				child.off("exit", onExit);
				if (startingChild === child) {
					startingChild = null;
				}
			};

			const onExit = (code: number) => {
				sidecar = null;
				if (settled) {
					return;
				}
				settled = true;
				cleanup();
				reject(
					new Error(`Sidecar exited before ready with code ${code}`),
				);
			};

			const onMessage = (message: SidecarMessage) => {
				if (settled) {
					return;
				}
				if (message.type === "ready") {
					settled = true;
					cleanup();
					resolve();
				}
				if (message.type === "error") {
					settled = true;
					cleanup();
					reject(
						Object.assign(new Error(message.error.message), {
							stack: message.error.stack,
						}),
					);
				}
			};

			child.on("message", onMessage);
			child.once("exit", onExit);
			child.postMessage({
				type: "start",
				hostname,
				port,
				username,
				password,
			});
		});

		child.once("exit", () => {
			sidecar = null;
			if (startingChild === child) {
				startingChild = null;
			}
		});

		return {
			url,
			username,
			password,
			stop: async () => {
				child.postMessage({ type: "stop" });
				await new Promise<void>((resolve) => {
					const timeout = setTimeout(() => {
						child.kill();
						resolve();
					}, 5000);
					child.once("exit", () => {
						clearTimeout(timeout);
						resolve();
					});
				});
			},
		};
	}

	return {
		ensure,
		fetch: sidecarFetch,
		stop,
	};
}

async function handleSidecarRuntimeMessage(
	child: ReturnType<typeof utilityProcess.fork>,
	message: unknown,
) {
	const request = parseAuthStorageRequest(message);
	if (!request) {
		return;
	}
	try {
		if (request.operation === "read") {
			child.postMessage({
				type: "auth-storage:response",
				id: request.id,
				ok: true,
				auth: await authStore.read(),
			});
			return;
		}
		await authStore.write(request.auth);
		child.postMessage({
			type: "auth-storage:response",
			id: request.id,
			ok: true,
		});
	} catch (error) {
		child.postMessage({
			type: "auth-storage:response",
			id: request.id,
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

function parseAuthStorageRequest(
	value: unknown,
): AuthStorageRequest | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const request = value as Partial<AuthStorageRequest>;
	if (
		request.type !== "auth-storage:request" ||
		typeof request.id !== "string"
	) {
		return undefined;
	}
	if (request.operation === "read") {
		return {
			type: "auth-storage:request",
			id: request.id,
			operation: "read",
		};
	}
	if (request.operation === "write") {
		return {
			type: "auth-storage:request",
			id: request.id,
			operation: "write",
			auth: isStoredOpenAiAuth(request.auth) ? request.auth : null,
		};
	}
	return undefined;
}

function isStoredOpenAiAuth(value: unknown): value is StoredOpenAiAuth {
	if (!value || typeof value !== "object") {
		return false;
	}
	const auth = value as Partial<StoredOpenAiAuth>;
	return (
		auth.type === "oauth" &&
		auth.provider === "openai" &&
		typeof auth.access === "string" &&
		typeof auth.refresh === "string" &&
		typeof auth.expires === "number" &&
		typeof auth.updatedAt === "string"
	);
}

function createMainOpenAiAuthStore() {
	async function read(): Promise<StoredOpenAiAuth | null> {
		try {
			const raw = await readFile(authPath(), "utf8");
			const parsed = parseStoredAuth(raw);
			return parsed.provider === "openai" ? parsed : null;
		} catch {
			return null;
		}
	}

	async function write(auth: StoredOpenAiAuth | null) {
		const file = authPath();
		await mkdir(dirname(file), { recursive: true });
		if (!auth) {
			await unlink(file).catch(() => undefined);
			return;
		}
		await writeFile(file, serializeStoredAuth(auth), { mode: 0o600 });
	}

	function authPath() {
		return join(app.getPath("userData"), "sidecar-auth", "openai.json");
	}

	return { read, write };
}

function parseStoredAuth(raw: string): StoredOpenAiAuth {
	const parsed = JSON.parse(raw) as StoredOpenAiAuth | StoredAuthEnvelope;
	if ("encoding" in parsed && parsed.encoding === "electron-safe-storage") {
		const decrypted = safeStorage.decryptString(
			Buffer.from(parsed.data, "base64"),
		);
		return JSON.parse(decrypted) as StoredOpenAiAuth;
	}
	return parsed as StoredOpenAiAuth;
}

function serializeStoredAuth(auth: StoredOpenAiAuth) {
	if (!safeStorage.isEncryptionAvailable()) {
		throw new Error("Electron safeStorage encryption is unavailable");
	}
	const encrypted = safeStorage.encryptString(JSON.stringify(auth));
	const envelope: StoredAuthEnvelope = {
		encoding: "electron-safe-storage",
		data: encrypted.toString("base64"),
		updatedAt: new Date().toISOString(),
	};
	return JSON.stringify(envelope, null, 2);
}

async function sidecarFetch(
	runtime: SidecarRuntime,
	path: string,
	init: RequestInit = {},
) {
	const response = await fetch(new URL(path, runtime.url), {
		...init,
		headers: {
			...init.headers,
			authorization: `Basic ${Buffer.from(`${runtime.username}:${runtime.password}`).toString("base64")}`,
		},
	});
	const body = (await response.json()) as unknown;
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body && "error" in body
				? String(body.error)
				: response.statusText,
		);
	}
	return body;
}

async function getFreePort() {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address !== "object") {
				server.close();
				reject(new Error("Failed to resolve free port"));
				return;
			}
			const { port } = address;
			server.close(() => resolve(port));
		});
	});
}
