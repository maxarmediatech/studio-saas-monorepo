import { app, dialog, ipcMain, shell } from "electron";
import type { SidecarManager, SidecarRuntime } from "./server";

const sessionEventStreams = new Map<string, AbortController>();

export function registerIpcHandlers(sidecarManager: SidecarManager) {
	ipcMain.handle("app:get-info", () => ({
		name: app.getName(),
		version: app.getVersion(),
		platform: process.platform,
		allowFullAccessMode:
			process.env.EXPERIMENTAL_DESKTOP_ENABLE_FULL_ACCESS_MODE === "1",
	}));

	ipcMain.handle("dialog:open-directory", async () => {
		const result = await dialog.showOpenDialog({
			title: "Choose a folder",
			properties: ["openDirectory", "createDirectory"],
		});
		if (result.canceled) {
			return null;
		}
		return result.filePaths[0] ?? null;
	});

	ipcMain.handle("dialog:open-file", async () => {
		const result = await dialog.showOpenDialog({
			title: "Choose a file",
			properties: ["openFile"],
		});
		if (result.canceled) {
			return null;
		}
		return result.filePaths[0] ?? null;
	});

	ipcMain.handle("shell:open-external", async (_event, url: string) => {
		const parsed = new URL(url);
		if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) {
			throw new Error(
				`Unsupported external URL protocol: ${parsed.protocol}`,
			);
		}
		await shell.openExternal(parsed.toString());
	});

	ipcMain.handle("sidecar:get-status", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/auth/openai/status");
	});

	ipcMain.handle("sidecar:start-openai-browser-auth", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/auth/openai/browser/start", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:refresh-openai", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/auth/openai/refresh", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:logout-openai", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/auth/openai/logout", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:get-codex-provider-status", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/providers/codex/status");
	});

	ipcMain.handle("sidecar:probe-codex-app-server", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/providers/codex/probe", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:create-session", async (_event, input) => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/sessions", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(input ?? {}),
		});
	});

	ipcMain.handle(
		"sidecar:send-session-message",
		async (_event, sessionId: string, input) => {
			const runtime = await sidecarManager.ensure();
			return sidecarManager.fetch(
				runtime,
				`/sessions/${encodeURIComponent(sessionId)}/messages`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(input ?? {}),
				},
			);
		},
	);

	ipcMain.handle(
		"sidecar:respond-session-request",
		async (
			_event,
			sessionId: string,
			requestId: string,
			input: unknown,
		) => {
			const runtime = await sidecarManager.ensure();
			return sidecarManager.fetch(
				runtime,
				`/sessions/${encodeURIComponent(sessionId)}/requests/${encodeURIComponent(requestId)}/respond`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(input ?? {}),
				},
			);
		},
	);

	ipcMain.handle(
		"sidecar:start-session-events",
		async (event, input: { sessionId: string; subscriptionId: string }) => {
			const runtime = await sidecarManager.ensure();
			const abort = new AbortController();
			sessionEventStreams.set(input.subscriptionId, abort);
			void streamSessionEvents({
				runtime,
				sessionId: input.sessionId,
				subscriptionId: input.subscriptionId,
				signal: abort.signal,
				send: (payload) => {
					if (!event.sender.isDestroyed()) {
						event.sender.send(
							`sidecar:session-event:${input.subscriptionId}`,
							payload,
						);
					}
				},
			})
				.catch((error) => {
					if (!abort.signal.aborted && !event.sender.isDestroyed()) {
						event.sender.send(
							`sidecar:session-event:${input.subscriptionId}`,
							{
								id: input.subscriptionId,
								type: "message.failed",
								time: new Date().toISOString(),
								data: {
									error:
										error instanceof Error
											? error.message
											: String(error),
								},
							},
						);
					}
				})
				.finally(() => {
					sessionEventStreams.delete(input.subscriptionId);
				});
			return { ok: true };
		},
	);

	ipcMain.handle(
		"sidecar:stop-session-events",
		(_event, subscriptionId: string) => {
			sessionEventStreams.get(subscriptionId)?.abort();
			sessionEventStreams.delete(subscriptionId);
			return { ok: true };
		},
	);
}

async function streamSessionEvents(input: {
	runtime: SidecarRuntime;
	sessionId: string;
	subscriptionId: string;
	signal: AbortSignal;
	send: (payload: unknown) => void;
}) {
	const response = await fetch(
		new URL(
			`/sessions/${encodeURIComponent(input.sessionId)}/events`,
			input.runtime.url,
		),
		{
			headers: {
				authorization: `Basic ${Buffer.from(`${input.runtime.username}:${input.runtime.password}`).toString("base64")}`,
			},
			signal: input.signal,
		},
	);
	if (!response.ok || !response.body) {
		throw new Error(`Session event stream failed: ${response.status}`);
	}
	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";
	while (!input.signal.aborted) {
		const { done, value } = await reader.read();
		if (done) {
			break;
		}
		buffer += decoder.decode(value, { stream: true });
		const messages = buffer.split("\n\n");
		buffer = messages.pop() ?? "";
		for (const message of messages) {
			const payload = parseSseMessage(message);
			if (payload) {
				input.send(payload);
			}
		}
	}
}

function parseSseMessage(message: string) {
	let eventName = "";
	const dataLines: string[] = [];
	for (const line of message.split("\n")) {
		if (line.startsWith("event:")) {
			eventName = line.slice("event:".length).trim();
		}
		if (line.startsWith("data:")) {
			dataLines.push(line.slice("data:".length).trimStart());
		}
	}
	if (!dataLines.length || eventName === "ready" || eventName === "ping") {
		return undefined;
	}
	try {
		return JSON.parse(dataLines.join("\n")) as unknown;
	} catch {
		return undefined;
	}
}
