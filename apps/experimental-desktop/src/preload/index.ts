import { contextBridge, ipcRenderer } from "electron";
import type { AppInfo, ExperimentalDesktopApi } from "./types";

const api: ExperimentalDesktopApi = {
	getAppInfo: () => ipcRenderer.invoke("app:get-info") as Promise<AppInfo>,
	openDirectory: () =>
		ipcRenderer.invoke("dialog:open-directory") as Promise<string | null>,
	openFile: () =>
		ipcRenderer.invoke("dialog:open-file") as Promise<string | null>,
	openExternal: (url) =>
		ipcRenderer.invoke("shell:open-external", url) as Promise<void>,
};

contextBridge.exposeInMainWorld("experimentalDesktop", api);
