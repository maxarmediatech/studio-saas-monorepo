import { contextBridge, ipcRenderer } from "electron";
import type {
	AppInfo,
	CodexTestResponse,
	ExperimentalDesktopApi,
	OpenAiAuthStart,
	OpenAiAuthStatus,
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
	sendCodexTest: () =>
		ipcRenderer.invoke(
			"sidecar:send-codex-test",
		) as Promise<CodexTestResponse>,
};

contextBridge.exposeInMainWorld("experimentalDesktop", api);
