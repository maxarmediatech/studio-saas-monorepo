import { contextBridge, ipcRenderer } from "electron";
import type {
	AppInfo,
	CodexAppServerProbe,
	CodexProviderStatus,
	CodexSession,
	CodexTestResponse,
	ExperimentalDesktopApi,
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
	sendCodexTest: () =>
		ipcRenderer.invoke(
			"sidecar:send-codex-test",
		) as Promise<CodexTestResponse>,
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
		void ipcRenderer.invoke("sidecar:start-session-events", {
			sessionId,
			subscriptionId,
		});
		return () => {
			ipcRenderer.off(channel, handler);
			void ipcRenderer.invoke(
				"sidecar:stop-session-events",
				subscriptionId,
			);
		};
	},
};

contextBridge.exposeInMainWorld("experimentalDesktop", api);
