import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, utilityProcess } from "electron";

const currentDir = dirname(fileURLToPath(import.meta.url));

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

	async function ensure() {
		if (sidecar) {
			return sidecar;
		}
		sidecarStarting ??= spawnSidecar().finally(() => {
			sidecarStarting = null;
		});
		sidecar = await sidecarStarting;
		return sidecar;
	}

	async function stop() {
		await sidecar?.stop();
		sidecar = null;
		sidecarStarting = null;
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

		child.stdout?.on("data", (chunk: Buffer) => {
			console.log(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			console.warn(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
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
				userDataPath: app.getPath("userData"),
			});
		});

		child.once("exit", () => {
			sidecar = null;
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
