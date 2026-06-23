import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, relative, resolve } from "node:path";
import { app, dialog, ipcMain, shell } from "electron";
import {
	attachmentExtensionForMimeType,
	formatAttachmentLimitBytes,
	inferAttachmentMimeType,
	isSupportedAttachmentMimeType,
	MAX_ATTACHMENT_SIZE_BYTES,
} from "../shared/composerAttachmentPolicy";
import { scanComposerFolderContext } from "./composer-folder-context";
import { createConversationController } from "./conversations/controller";
import type { SidecarManager, SidecarRuntime } from "./server";
import { openConversationDatabase } from "./storage/database";

const sessionEventStreams = new Map<string, AbortController>();
const conversationEventStreams = new Map<string, () => void>();

export function registerIpcHandlers(sidecarManager: SidecarManager) {
	const conversationsDb = openConversationDatabase(
		join(app.getPath("userData"), "conversations.sqlite"),
	);
	const conversations = createConversationController({
		db: conversationsDb,
		sidecarManager,
	});
	app.once("before-quit", () => {
		conversations.stop();
		conversationsDb.close();
	});

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

	ipcMain.handle("attachment:write-file", async (_event, input) =>
		writeAttachmentFile(input),
	);

	ipcMain.handle("attachment:get-file-info", async (_event, path) =>
		getAttachmentFileInfo(path),
	);

	ipcMain.handle("workspace:search-files", (_event, input) =>
		searchWorkspaceFiles(input),
	);

	ipcMain.handle("workspace:scan-folder-context", (_event, input) =>
		scanComposerFolderContext(input),
	);

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

	ipcMain.handle("sidecar:update-codex-provider", async () => {
		const runtime = await sidecarManager.ensure();
		return sidecarManager.fetch(runtime, "/providers/codex/update", {
			method: "POST",
		});
	});

	ipcMain.handle("conversation:list", () =>
		conversations.listConversations(),
	);

	ipcMain.handle("conversation:get", (_event, conversationId: string) =>
		conversations.getConversation(conversationId),
	);

	ipcMain.handle("conversation:get-tree", (_event, conversationId: string) =>
		conversations.getConversationTree(conversationId),
	);

	ipcMain.handle(
		"conversation:branch-from-message",
		(_event, conversationId: string, input) =>
			conversations.branchConversation(conversationId, input),
	);

	ipcMain.handle(
		"conversation:copy-branch-from-message",
		(_event, conversationId: string, input) =>
			conversations.forkConversation(conversationId, input),
	);

	ipcMain.handle("draft:create", (_event, input) =>
		conversations.createDraft(input),
	);

	ipcMain.handle("draft:update", (_event, draftId: string, input) =>
		conversations.updateDraft(draftId, input),
	);

	ipcMain.handle("draft:promote-and-send", (_event, input) =>
		conversations.promoteDraftAndSend(input),
	);

	ipcMain.handle(
		"conversation:send-message",
		(_event, conversationId: string, input) =>
			conversations.sendConversationMessage(conversationId, input),
	);

	ipcMain.handle("conversation:interrupt", (_event, conversationId: string) =>
		conversations.interruptConversation(conversationId),
	);

	ipcMain.handle(
		"approval:respond",
		(_event, conversationId: string, requestId: string, input) =>
			conversations.respondApproval(conversationId, requestId, input),
	);

	ipcMain.handle(
		"conversation:rename",
		(_event, conversationId: string, input) =>
			conversations.renameConversation(conversationId, input),
	);

	ipcMain.handle("conversation:archive", (_event, conversationId: string) =>
		conversations.archiveConversation(conversationId),
	);

	ipcMain.handle("conversation:delete", (_event, conversationId: string) =>
		conversations.deleteConversation(conversationId),
	);

	ipcMain.handle(
		"conversation:subscribe-events",
		(event, input: { conversationId: string; subscriptionId: string }) => {
			const unsubscribe = conversations.subscribe(
				input.conversationId,
				(payload) => {
					if (!event.sender.isDestroyed()) {
						event.sender.send(
							`conversation:event:${input.subscriptionId}`,
							payload,
						);
					}
				},
			);
			conversationEventStreams.set(input.subscriptionId, unsubscribe);
			return { ok: true };
		},
	);

	ipcMain.handle(
		"conversation:stop-events",
		(_event, subscriptionId: string) => {
			conversationEventStreams.get(subscriptionId)?.();
			conversationEventStreams.delete(subscriptionId);
			return { ok: true };
		},
	);

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

const WORKSPACE_SEARCH_IGNORED_NAMES = new Set([
	".git",
	"node_modules",
	"dist",
	"out",
	".next",
	".turbo",
	"coverage",
	"build",
]);

async function searchWorkspaceFiles(input: unknown) {
	const record = input as {
		rootPath?: unknown;
		query?: unknown;
		limit?: unknown;
	};
	if (typeof record.rootPath !== "string" || !record.rootPath.trim()) {
		return [];
	}
	const rootPath = resolve(record.rootPath);
	const query =
		typeof record.query === "string"
			? record.query.trim().toLowerCase()
			: "";
	const limit =
		typeof record.limit === "number" && Number.isFinite(record.limit)
			? Math.max(1, Math.min(80, Math.floor(record.limit)))
			: 30;
	const rootStat = await stat(rootPath).catch(() => null);
	if (!rootStat?.isDirectory()) {
		return [];
	}

	const results: Array<{
		path: string;
		name: string;
		relativePath: string;
		kind: "file" | "directory";
	}> = [];
	const queue = [rootPath];
	let visited = 0;
	const maxVisited = 4500;

	while (queue.length > 0 && visited < maxVisited && results.length < limit) {
		const current = queue.shift();
		if (!current) {
			break;
		}
		visited += 1;
		const entries = await readdir(current, { withFileTypes: true }).catch(
			() => [],
		);
		for (const entry of entries) {
			if (
				entry.isSymbolicLink() ||
				WORKSPACE_SEARCH_IGNORED_NAMES.has(entry.name)
			) {
				continue;
			}
			const fullPath = join(current, entry.name);
			const relativePath = relative(rootPath, fullPath);
			const normalizedRelativePath = relativePath.split("\\").join("/");
			const kind = entry.isDirectory()
				? "directory"
				: entry.isFile()
					? "file"
					: null;
			if (!kind) {
				continue;
			}
			if (
				!query ||
				normalizedRelativePath.toLowerCase().includes(query)
			) {
				results.push({
					path: fullPath,
					name: basename(fullPath),
					relativePath: normalizedRelativePath,
					kind,
				});
				if (results.length >= limit) {
					break;
				}
			}
			if (kind === "directory") {
				queue.push(fullPath);
			}
		}
	}
	return results.sort((left, right) => {
		if (left.kind !== right.kind) {
			return left.kind === "file" ? -1 : 1;
		}
		return left.relativePath.localeCompare(right.relativePath);
	});
}

async function writeAttachmentFile(input: unknown) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Attachment input must be an object");
	}
	const body = input as {
		data?: ArrayBuffer | ArrayBufferView;
		name?: string;
		mimeType?: string;
	};
	if (!(body.data instanceof ArrayBuffer) && !ArrayBuffer.isView(body.data)) {
		throw new Error("Attachment data is required");
	}
	const buffer = bufferFromAttachmentData(body.data);
	if (buffer.byteLength === 0) {
		throw new Error("Attachment data is empty");
	}
	if (buffer.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error(
			`Attachment is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}`,
		);
	}
	const mimeType = inferAttachmentMimeType({
		name: body.name,
		mimeType: body.mimeType,
	});
	if (!isSupportedAttachmentMimeType(mimeType)) {
		throw new Error("Unsupported attachment type");
	}
	const extension = attachmentExtension(body.name, mimeType);
	const name = safeAttachmentName(body.name, extension);
	const directory = join(app.getPath("userData"), "composer-attachments");
	await mkdir(directory, { recursive: true });
	const path = join(directory, `${randomUUID()}-${name}`);
	await writeFile(path, buffer);
	return {
		path,
		name,
		mimeType,
		size: buffer.byteLength,
	};
}

function bufferFromAttachmentData(data: ArrayBuffer | ArrayBufferView) {
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data);
	}
	return Buffer.from(
		new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
	);
}

async function getAttachmentFileInfo(path: unknown) {
	if (typeof path !== "string" || !path.trim()) {
		throw new Error("Attachment path is required");
	}
	const resolvedPath = resolve(path);
	const info = await stat(resolvedPath);
	if (!info.isFile()) {
		throw new Error("Attachment path must be a file");
	}
	if (info.size > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error(
			`Attachment is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}`,
		);
	}
	const mimeType = inferAttachmentMimeType({ path: resolvedPath });
	if (!isSupportedAttachmentMimeType(mimeType)) {
		throw new Error("Unsupported attachment type");
	}
	return {
		path: resolvedPath,
		name: basename(resolvedPath),
		mimeType,
		size: info.size,
	};
}

function safeAttachmentName(name: unknown, extension: string) {
	const raw =
		typeof name === "string" && name.trim() ? basename(name.trim()) : "";
	const withoutUnsafe = raw.replace(/[^a-zA-Z0-9._-]/g, "-");
	if (withoutUnsafe) {
		return withoutUnsafe.includes(".")
			? withoutUnsafe
			: `${withoutUnsafe}${extension}`;
	}
	return `clipboard${extension}`;
}

function attachmentExtension(name: unknown, mimeType: string | undefined) {
	if (typeof name === "string") {
		const extension = extname(name);
		if (extension) {
			return extension;
		}
	}
	return attachmentExtensionForMimeType(mimeType) ?? ".bin";
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
