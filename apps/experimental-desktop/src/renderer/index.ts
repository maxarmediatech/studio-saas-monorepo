import "./styles.css";
import type { CodexRuntimeMode, SessionEvent } from "../preload/types";

const appInfo = document.querySelector<HTMLParagraphElement>("#app-info");
const selection = document.querySelector<HTMLParagraphElement>("#selection");
const openFolder = document.querySelector<HTMLButtonElement>("#open-folder");
const openFile = document.querySelector<HTMLButtonElement>("#open-file");
const openDocs = document.querySelector<HTMLButtonElement>("#open-docs");
const openAiStatus =
	document.querySelector<HTMLParagraphElement>("#openai-status");
const openAiDetail =
	document.querySelector<HTMLParagraphElement>("#openai-detail");
const connectOpenAi =
	document.querySelector<HTMLButtonElement>("#connect-openai");
const refreshOpenAi =
	document.querySelector<HTMLButtonElement>("#refresh-openai");
const probeCodexAppServer = document.querySelector<HTMLButtonElement>(
	"#probe-codex-app-server",
);
const sendCodexTest =
	document.querySelector<HTMLButtonElement>("#send-codex-test");
const logoutOpenAi =
	document.querySelector<HTMLButtonElement>("#logout-openai");
const sessionStatus =
	document.querySelector<HTMLParagraphElement>("#session-status");
const newSession = document.querySelector<HTMLButtonElement>("#new-session");
const sendSessionMessage = document.querySelector<HTMLButtonElement>(
	"#send-session-message",
);
const sessionMode = document.querySelector<HTMLSelectElement>("#session-mode");
const sessionInput =
	document.querySelector<HTMLTextAreaElement>("#session-input");
const sessionRequests =
	document.querySelector<HTMLDivElement>("#session-requests");
const sessionOutput = document.querySelector<HTMLPreElement>("#session-output");
const sessionEventLog =
	document.querySelector<HTMLPreElement>("#session-event-log");
let authPoll: number | undefined;
let currentSessionId: string | undefined;
let unsubscribeSessionEvents: (() => void) | undefined;
let assistantText = "";
let currentSessionMode: CodexRuntimeMode = "read-only";
let recentSessionEvents: string[] = [];
let selectedFolderPath: string | undefined;
const pendingRequests = new Map<
	string,
	Extract<SessionEvent, { type: "request.pending" }>
>();

function setSelection(value: string | null, fallback: string) {
	if (!selection) {
		return;
	}
	selection.textContent = value ?? fallback;
}

async function boot() {
	const info = await window.experimentalDesktop.getAppInfo();
	if (appInfo) {
		appInfo.textContent = `${info.name} ${info.version} · ${info.platform}`;
	}
	configureRuntimeModeOptions(info.allowFullAccessMode);
	await refreshOpenAiStatus();
}

async function refreshOpenAiStatus() {
	if (openAiStatus) {
		openAiStatus.textContent = "Checking...";
	}

	try {
		const status = await window.experimentalDesktop.getOpenAiAuthStatus();
		if (openAiStatus) {
			openAiStatus.textContent = status.connected
				? "Connected"
				: status.expired
					? "Expired"
					: "Not connected";
		}
		if (openAiDetail) {
			openAiDetail.textContent = status.connected
				? `Account ${status.accountId ?? "unknown"} · expires ${status.expires ? new Date(status.expires).toLocaleString() : "unknown"}`
				: status.expired
					? "Token exists but is expired. Refresh or reconnect."
					: "Use browser OAuth to connect a ChatGPT Pro/Plus account.";
		}
		return status.connected;
	} catch (error) {
		if (openAiStatus) {
			openAiStatus.textContent = "Sidecar error";
		}
		if (openAiDetail) {
			openAiDetail.textContent =
				error instanceof Error ? error.message : String(error);
		}
		return false;
	}
}

function startAuthPolling() {
	window.clearInterval(authPoll);
	const startedAt = Date.now();
	authPoll = window.setInterval(async () => {
		const connected = await refreshOpenAiStatus();
		const timedOut = Date.now() - startedAt > 5 * 60 * 1000;
		if (connected || timedOut) {
			window.clearInterval(authPoll);
			authPoll = undefined;
		}
	}, 2000);
}

openFolder?.addEventListener("click", async () => {
	const path = await window.experimentalDesktop.openDirectory();
	selectedFolderPath = path ?? undefined;
	setSelection(path, "Folder picker canceled.");
});

openFile?.addEventListener("click", async () => {
	const path = await window.experimentalDesktop.openFile();
	setSelection(path, "File picker canceled.");
});

openDocs?.addEventListener("click", () => {
	void window.experimentalDesktop.openExternal(
		"https://www.electronjs.org/docs/latest",
	);
});

connectOpenAi?.addEventListener("click", async () => {
	if (openAiStatus) {
		openAiStatus.textContent = "Starting browser OAuth...";
	}
	const auth = await window.experimentalDesktop.startOpenAiBrowserAuth();
	if (openAiDetail) {
		openAiDetail.textContent = auth.instructions;
	}
	await window.experimentalDesktop.openExternal(auth.url);
	startAuthPolling();
});

refreshOpenAi?.addEventListener("click", () => {
	void window.experimentalDesktop
		.refreshOpenAiAuth()
		.catch(() => undefined)
		.finally(() => void refreshOpenAiStatus());
});

probeCodexAppServer?.addEventListener("click", async () => {
	if (openAiStatus) {
		openAiStatus.textContent = "Probing Codex app-server...";
	}
	try {
		const status =
			await window.experimentalDesktop.getCodexProviderStatus();
		if (!status.binary.available) {
			throw new Error(
				`Codex binary unavailable at '${status.binary.path}': ${status.binary.error}`,
			);
		}
		const result = await window.experimentalDesktop.probeCodexAppServer();
		if (openAiStatus) {
			openAiStatus.textContent = "Codex app-server ready";
		}
		if (openAiDetail) {
			openAiDetail.textContent = summarizeCodexResult({
				version: status.binary.version,
				home: result.provider.effectiveCodexHome,
				account: result.account,
			});
		}
	} catch (error) {
		if (openAiStatus) {
			openAiStatus.textContent = "Codex app-server probe failed";
		}
		if (openAiDetail) {
			openAiDetail.textContent =
				error instanceof Error ? error.message : String(error);
		}
	}
});

sendCodexTest?.addEventListener("click", async () => {
	if (openAiStatus) {
		openAiStatus.textContent = "Sending Codex test...";
	}
	try {
		const result = await runCodexSessionSmokeTest();
		if (openAiStatus) {
			openAiStatus.textContent = "Codex session delta received";
		}
		if (openAiDetail) {
			openAiDetail.textContent = summarizeCodexResult(result);
		}
	} catch (error) {
		if (openAiStatus) {
			openAiStatus.textContent = "Codex test failed";
		}
		if (openAiDetail) {
			openAiDetail.textContent =
				error instanceof Error ? error.message : String(error);
		}
	}
});

async function runCodexSessionSmokeTest() {
	const session = await window.experimentalDesktop.createSession({
		model: "gpt-5.4-mini",
		runtimeMode: getSelectedSessionMode(),
		...(selectedFolderPath ? { cwd: selectedFolderPath } : {}),
	});
	let unsubscribe: () => void = () => undefined;
	let resolveFirstDelta: (event: SessionEvent) => void = () => undefined;
	let rejectFirstDelta: (error: Error) => void = () => undefined;
	const firstDelta = new Promise<SessionEvent>((resolve, reject) => {
		resolveFirstDelta = resolve;
		rejectFirstDelta = reject;
	});
	const timeout = window.setTimeout(() => {
		unsubscribe();
		rejectFirstDelta(
			new Error("Codex session did not emit an assistant delta"),
		);
	}, 30_000);
	unsubscribe = await window.experimentalDesktop.subscribeSessionEvents(
		session.id,
		(event) => {
			if (event.type === "assistant.delta") {
				window.clearTimeout(timeout);
				unsubscribe();
				resolveFirstDelta(event);
			}
			if (event.type === "message.failed") {
				window.clearTimeout(timeout);
				unsubscribe();
				rejectFirstDelta(new Error(event.data.error));
			}
		},
	);
	await window.experimentalDesktop.sendSessionMessage(session.id, {
		text: "Reply with one short sentence confirming the Codex app-server session path works.",
		model: "gpt-5.4-mini",
	});
	return firstDelta;
}

newSession?.addEventListener("click", async () => {
	try {
		setSessionStatus("Creating session...");
		unsubscribeSessionEvents?.();
		assistantText = "";
		recentSessionEvents = [];
		pendingRequests.clear();
		writeSessionOutput("");
		renderSessionEventLog();
		renderPendingRequests();
		const session = await window.experimentalDesktop.createSession({
			model: "gpt-5.4-mini",
			runtimeMode: getSelectedSessionMode(),
			...(selectedFolderPath ? { cwd: selectedFolderPath } : {}),
		});
		currentSessionId = session.id;
		currentSessionMode = getSelectedSessionMode();
		unsubscribeSessionEvents =
			await window.experimentalDesktop.subscribeSessionEvents(
				session.id,
				handleSessionEvent,
			);
		setSessionStatus(
			`Ready · ${formatRuntimeMode(currentSessionMode)} · ${session.threadId ?? session.id}`,
		);
	} catch (error) {
		setSessionStatus(
			error instanceof Error ? error.message : String(error),
		);
	}
});

sendSessionMessage?.addEventListener("click", async () => {
	try {
		if (!currentSessionId) {
			const session = await window.experimentalDesktop.createSession({
				model: "gpt-5.4-mini",
				runtimeMode: getSelectedSessionMode(),
				...(selectedFolderPath ? { cwd: selectedFolderPath } : {}),
			});
			currentSessionId = session.id;
			currentSessionMode = getSelectedSessionMode();
			unsubscribeSessionEvents =
				await window.experimentalDesktop.subscribeSessionEvents(
					session.id,
					handleSessionEvent,
				);
		}
		const text = sessionInput?.value.trim();
		if (!text) {
			setSessionStatus("Message required");
			return;
		}
		assistantText = "";
		recentSessionEvents = [];
		pendingRequests.clear();
		writeSessionOutput("");
		renderSessionEventLog();
		renderPendingRequests();
		setSessionStatus("Sending...");
		await window.experimentalDesktop.sendSessionMessage(currentSessionId, {
			text,
			model: "gpt-5.4-mini",
		});
		setSessionStatus("Running...");
	} catch (error) {
		setSessionStatus(
			error instanceof Error ? error.message : String(error),
		);
	}
});

logoutOpenAi?.addEventListener("click", async () => {
	await window.experimentalDesktop.logoutOpenAi();
	await refreshOpenAiStatus();
});

function handleSessionEvent(event: SessionEvent) {
	appendSessionEvent(event);
	if (event.type === "message.created") {
		setSessionStatus("Running...");
		return;
	}
	if (event.type === "assistant.delta") {
		assistantText += event.data.text ?? "";
		writeSessionOutput(assistantText);
		setSessionStatus("Streaming...");
		return;
	}
	if (event.type === "assistant.completed") {
		setSessionStatus("Completed");
		return;
	}
	if (event.type === "message.failed") {
		pendingRequests.clear();
		renderPendingRequests();
		setSessionStatus(`Failed · ${event.data.error}`);
		return;
	}
	if (event.type === "request.pending") {
		pendingRequests.set(event.data.requestId, event);
		renderPendingRequests();
		setSessionStatus(`Waiting for ${event.data.requestKind} approval`);
		return;
	}
	if (event.type === "request.resolved") {
		pendingRequests.delete(event.data.requestId);
		renderPendingRequests();
		setSessionStatus("Running...");
		return;
	}
}

function setSessionStatus(value: string) {
	if (sessionStatus) {
		sessionStatus.textContent = value;
	}
}

function writeSessionOutput(value: string) {
	if (sessionOutput) {
		sessionOutput.textContent = value;
		sessionOutput.scrollTop = sessionOutput.scrollHeight;
	}
}

function appendSessionEvent(event: SessionEvent) {
	recentSessionEvents = [
		...recentSessionEvents,
		`${new Date(event.time).toLocaleTimeString()} ${event.type} ${summarizeSessionEvent(event)}`,
	].slice(-50);
	renderSessionEventLog();
}

function renderSessionEventLog() {
	if (sessionEventLog) {
		sessionEventLog.textContent = recentSessionEvents.join("\n");
		sessionEventLog.scrollTop = sessionEventLog.scrollHeight;
	}
}

function summarizeSessionEvent(event: SessionEvent) {
	if (event.type === "message.created") {
		return trimForLog(event.data.text);
	}
	if (event.type === "assistant.delta") {
		return trimForLog(event.data.text ?? "");
	}
	if (event.type === "assistant.completed") {
		return event.data.turnId ? `turn=${event.data.turnId}` : "";
	}
	if (event.type === "message.failed") {
		return trimForLog(event.data.error);
	}
	if (event.type === "request.pending") {
		return [
			event.data.requestKind,
			event.data.turnId ? `turn=${event.data.turnId}` : "",
			event.data.itemId ? `item=${event.data.itemId}` : "",
		]
			.filter(Boolean)
			.join(" ");
	}
	if (event.type === "request.resolved") {
		return `request=${event.data.requestId}`;
	}
	if (event.type === "provider.raw") {
		return event.data.method;
	}
	return "";
}

function trimForLog(value: string) {
	const trimmed = value.replace(/\s+/g, " ").trim();
	return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

function getSelectedSessionMode(): CodexRuntimeMode {
	const value = sessionMode?.value;
	if (
		value === "read-only" ||
		value === "workspace-write" ||
		value === "full-access"
	) {
		return value;
	}
	return "read-only";
}

function formatRuntimeMode(mode: CodexRuntimeMode) {
	if (mode === "workspace-write") {
		return "Workspace Edit";
	}
	if (mode === "full-access") {
		return "Full Access - no approvals";
	}
	return "Read Only";
}

function configureRuntimeModeOptions(allowFullAccessMode: boolean) {
	if (!sessionMode || !allowFullAccessMode) {
		return;
	}
	const option = document.createElement("option");
	option.value = "full-access";
	option.textContent = "Full Access - no approvals";
	sessionMode.append(option);
}

function renderPendingRequests() {
	if (!sessionRequests) {
		return;
	}
	sessionRequests.replaceChildren(
		...Array.from(pendingRequests.values()).map((event) =>
			createRequestCard(event),
		),
	);
}

function createRequestCard(
	event: Extract<SessionEvent, { type: "request.pending" }>,
) {
	const card = document.createElement("div");
	card.className = "request-card";
	const title = document.createElement("p");
	title.className = "request-title";
	title.textContent = `${event.data.requestKind} request`;
	const detail = document.createElement("pre");
	detail.className = "request-detail";
	detail.textContent = summarizeRequest(event.data.raw);
	const actions = document.createElement("div");
	actions.className = "actions";
	if (event.data.requestKind !== "user-input") {
		actions.append(
			createRequestButton("Accept Once", () => {
				void respondToPendingRequest(event, "accept");
			}),
			createRequestButton("Accept For Session", () => {
				void respondToPendingRequest(event, "acceptForSession");
			}),
			createRequestButton("Decline", () => {
				void respondToPendingRequest(event, "decline");
			}),
			createRequestButton("Cancel", () => {
				void respondToPendingRequest(event, "cancel");
			}),
		);
	} else {
		actions.append(
			createRequestButton("Answer Default", () => {
				void respondToPendingRequest(event, "accept");
			}),
			createRequestButton("Cancel", () => {
				void respondToPendingRequest(event, "cancel");
			}),
		);
	}
	card.append(title, detail, actions);
	return card;
}

function createRequestButton(label: string, onClick: () => void) {
	const button = document.createElement("button");
	button.type = "button";
	button.textContent = label;
	button.addEventListener("click", onClick);
	return button;
}

async function respondToPendingRequest(
	event: Extract<SessionEvent, { type: "request.pending" }>,
	decision: "accept" | "acceptForSession" | "decline" | "cancel",
) {
	if (!currentSessionId) {
		return;
	}
	try {
		if (event.data.requestKind === "user-input") {
			if (decision === "cancel") {
				await window.experimentalDesktop.respondSessionRequest(
					currentSessionId,
					event.data.requestId,
					{ decision },
				);
			} else {
				await window.experimentalDesktop.respondSessionRequest(
					currentSessionId,
					event.data.requestId,
					{ answers: defaultAnswers(event.data.raw) },
				);
			}
		} else {
			await window.experimentalDesktop.respondSessionRequest(
				currentSessionId,
				event.data.requestId,
				{ decision },
			);
		}
		pendingRequests.delete(event.data.requestId);
		renderPendingRequests();
		setSessionStatus("Running...");
	} catch (error) {
		setSessionStatus(
			error instanceof Error ? error.message : String(error),
		);
	}
}

function defaultAnswers(value: unknown) {
	const answers: Record<string, string[]> = {};
	if (!value || typeof value !== "object" || !("questions" in value)) {
		return answers;
	}
	const questions = (value as { questions?: unknown }).questions;
	if (!Array.isArray(questions)) {
		return answers;
	}
	for (const question of questions) {
		if (!question || typeof question !== "object") {
			continue;
		}
		const record = question as {
			id?: unknown;
			options?: unknown;
		};
		if (typeof record.id !== "string") {
			continue;
		}
		const firstOption = Array.isArray(record.options)
			? record.options.find(
					(option): option is { label: string } =>
						!!option &&
						typeof option === "object" &&
						"label" in option &&
						typeof option.label === "string",
				)
			: undefined;
		answers[record.id] = [firstOption?.label ?? "ok"];
	}
	return answers;
}

function summarizeRequest(value: unknown) {
	if (!value || typeof value !== "object") {
		return String(value);
	}
	const record = value as Record<string, unknown>;
	const lines = [
		typeof record.command === "string" ? `command: ${record.command}` : "",
		typeof record.path === "string" ? `path: ${record.path}` : "",
		typeof record.itemId === "string" ? `item: ${record.itemId}` : "",
		Array.isArray(record.questions)
			? `questions: ${record.questions.length}`
			: "",
	].filter(Boolean);
	return lines.length ? lines.join("\n") : JSON.stringify(value, null, 2);
}

function summarizeCodexResult(value: unknown) {
	if (typeof value === "string") {
		return value;
	}
	if (value && typeof value === "object") {
		const outputText = findOutputText(value);
		if (outputText) {
			return outputText;
		}
		return JSON.stringify(value).slice(0, 600);
	}
	return String(value);
}

function findOutputText(value: unknown): string | undefined {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	if ("output_text" in value && typeof value.output_text === "string") {
		return value.output_text;
	}
	if ("text" in value && typeof value.text === "string") {
		return value.text;
	}
	if ("output" in value && Array.isArray(value.output)) {
		for (const item of value.output) {
			const nested = findOutputText(item);
			if (nested) {
				return nested;
			}
			if (item && typeof item === "object" && "content" in item) {
				const content = item.content;
				if (Array.isArray(content)) {
					for (const part of content) {
						const text = findOutputText(part);
						if (text) {
							return text;
						}
					}
				}
			}
		}
	}
	return undefined;
}

void boot();
