import { contextBridge, ipcRenderer } from "electron";
import type {
	AppInfo,
	CodexAppServerProbe,
	CodexProviderStatus,
	CodexSession,
	ConversationDetail,
	ConversationEvent,
	ConversationSummary,
	ConversationTreeNode,
	DraftRecord,
	ExperimentalDesktopApi,
	ForkedConversation,
	OpenAiAuthStart,
	OpenAiAuthStatus,
	SendSessionMessageResult,
	SessionEvent,
} from "./types";

const api: ExperimentalDesktopApi = {
	getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
	openDirectory: () =>
		ipcRenderer.invoke("dialog:open-directory") as Promise<string | null>,
	openFile: () =>
		ipcRenderer.invoke("dialog:open-file") as Promise<string | null>,
	openExternal: (url) =>
		ipcRenderer.invoke("shell:open-external", url) as Promise<void>,
	getOpenAiAuthStatus: () =>
		ipcRenderer.invoke("sidecar:get-status") as Promise<OpenAiAuthStatus>,
	startOpenAiBrowserAuth: () =>
		ipcRenderer.invoke(
			"sidecar:start-openai-browser-auth",
		) as Promise<OpenAiAuthStart>,
	refreshOpenAiAuth: () =>
		ipcRenderer.invoke(
			"sidecar:refresh-openai",
		) as Promise<OpenAiAuthStatus>,
	logoutOpenAi: () =>
		ipcRenderer.invoke("sidecar:logout-openai") as Promise<{ ok: true }>,
	getCodexProviderStatus: () =>
		ipcRenderer.invoke(
			"sidecar:get-codex-provider-status",
		) as Promise<CodexProviderStatus>,
	probeCodexAppServer: () =>
		ipcRenderer.invoke(
			"sidecar:probe-codex-app-server",
		) as Promise<CodexAppServerProbe>,
	updateCodexProvider: () =>
		ipcRenderer.invoke(
			"sidecar:update-codex-provider",
		) as Promise<CodexProviderStatus>,
	listConversations: () =>
		ipcRenderer.invoke("conversation:list") as Promise<
			ConversationSummary[]
		>,
	getConversation: (conversationId) =>
		ipcRenderer.invoke("conversation:get", conversationId) as Promise<
			ConversationDetail | undefined
		>,
	getConversationTree: (conversationId) =>
		ipcRenderer.invoke("conversation:get-tree", conversationId) as Promise<
			ConversationTreeNode[]
		>,
	branchConversationFromMessage: (conversationId, input) =>
		ipcRenderer.invoke(
			"conversation:branch-from-message",
			conversationId,
			input,
		) as Promise<ConversationDetail | undefined>,
	copyConversationBranchFromMessage: (conversationId, input) =>
		ipcRenderer.invoke(
			"conversation:copy-branch-from-message",
			conversationId,
			input,
		) as Promise<ForkedConversation>,
	createDraft: (input) =>
		ipcRenderer.invoke("draft:create", input ?? {}) as Promise<DraftRecord>,
	updateDraft: (draftId, input) =>
		ipcRenderer.invoke(
			"draft:update",
			draftId,
			input,
		) as Promise<DraftRecord>,
	promoteDraftAndSend: (input) =>
		ipcRenderer.invoke("draft:promote-and-send", input) as Promise<
			ConversationDetail | undefined
		>,
	sendConversationMessage: (conversationId, input) =>
		ipcRenderer.invoke(
			"conversation:send-message",
			conversationId,
			input,
		) as Promise<ConversationDetail | undefined>,
	respondApproval: (conversationId, requestId, input) =>
		ipcRenderer.invoke(
			"approval:respond",
			conversationId,
			requestId,
			input,
		) as Promise<{ ok: true }>,
	renameConversation: (conversationId, input) =>
		ipcRenderer.invoke(
			"conversation:rename",
			conversationId,
			input,
		) as Promise<ConversationDetail | undefined>,
	archiveConversation: (conversationId) =>
		ipcRenderer.invoke("conversation:archive", conversationId) as Promise<
			ConversationDetail | undefined
		>,
	deleteConversation: (conversationId) =>
		ipcRenderer.invoke("conversation:delete", conversationId) as Promise<{
			ok: true;
		}>,
	subscribeConversationEvents: (conversationId, listener) => {
		const subscriptionId = crypto.randomUUID();
		const channel = `conversation:event:${subscriptionId}`;
		const handler = (
			_event: Electron.IpcRendererEvent,
			payload: unknown,
		) => {
			listener(payload as ConversationEvent);
		};
		ipcRenderer.on(channel, handler);
		return ipcRenderer
			.invoke("conversation:subscribe-events", {
				conversationId,
				subscriptionId,
			})
			.then(() => () => {
				ipcRenderer.off(channel, handler);
				void ipcRenderer.invoke(
					"conversation:stop-events",
					subscriptionId,
				);
			})
			.catch((error: unknown) => {
				ipcRenderer.off(channel, handler);
				listener({
					id: subscriptionId,
					type: "message.failed",
					time: new Date().toISOString(),
					data: {
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				});
				return () => undefined;
			});
	},
	createSession: (input) =>
		ipcRenderer.invoke(
			"sidecar:create-session",
			input ?? {},
		) as Promise<CodexSession>,
	sendSessionMessage: (sessionId, input) =>
		ipcRenderer.invoke(
			"sidecar:send-session-message",
			sessionId,
			input,
		) as Promise<SendSessionMessageResult>,
	respondSessionRequest: (sessionId, requestId, input) =>
		ipcRenderer.invoke(
			"sidecar:respond-session-request",
			sessionId,
			requestId,
			input,
		) as Promise<{ ok: true }>,
	subscribeSessionEvents: (sessionId, listener) => {
		const subscriptionId = crypto.randomUUID();
		const channel = `sidecar:session-event:${subscriptionId}`;
		const handler = (
			_event: Electron.IpcRendererEvent,
			payload: unknown,
		) => {
			listener(payload as SessionEvent);
		};
		ipcRenderer.on(channel, handler);
		return ipcRenderer
			.invoke("sidecar:start-session-events", {
				sessionId,
				subscriptionId,
			})
			.then(() => () => {
				ipcRenderer.off(channel, handler);
				void ipcRenderer.invoke(
					"sidecar:stop-session-events",
					subscriptionId,
				);
			})
			.catch((error: unknown) => {
				ipcRenderer.off(channel, handler);
				listener({
					id: subscriptionId,
					type: "message.failed",
					time: new Date().toISOString(),
					data: {
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				});
				return () => undefined;
			});
	},
};

contextBridge.exposeInMainWorld("experimentalDesktop", api);
