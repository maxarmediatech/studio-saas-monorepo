import { app, dialog, ipcMain, shell } from "electron";
import type { SidecarManager } from "./server";

export function registerIpcHandlers(sidecarManager: SidecarManager) {
	ipcMain.handle("app:get-info", () => ({
		name: app.getName(),
		version: app.getVersion(),
		platform: process.platform,
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

	ipcMain.handle("sidecar:send-codex-test", async () => {
		const runtime = await sidecarManager.ensure();
		const session = (await sidecarManager.fetch(runtime, "/sessions", {
			method: "POST",
		})) as { id: string };
		return sidecarManager.fetch(
			runtime,
			`/sessions/${encodeURIComponent(session.id)}/messages`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					text: "Reply with one short sentence confirming the Codex proxy works.",
				}),
			},
		);
	});
}
