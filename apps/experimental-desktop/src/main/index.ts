import { app, BrowserWindow } from "electron";
import { registerIpcHandlers } from "./ipc";
import { createSidecarManager } from "./server";
import { createMainWindow } from "./windows";

let mainWindow: BrowserWindow | null = null;
const sidecarManager = createSidecarManager();

if (!app.requestSingleInstanceLock()) {
	app.quit();
} else {
	app.on("second-instance", () => {
		if (!mainWindow) {
			return;
		}
		if (mainWindow.isMinimized()) {
			mainWindow.restore();
		}
		mainWindow.show();
		mainWindow.focus();
	});

	app.whenReady().then(() => {
		app.setName("Experimental Desktop");
		app.setAppUserModelId("com.stuwiz.experimental.desktop");
		registerIpcHandlers(sidecarManager);
		mainWindow = createMainWindow();
		mainWindow.on("closed", () => {
			mainWindow = null;
		});
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			mainWindow = createMainWindow();
			mainWindow.on("closed", () => {
				mainWindow = null;
			});
		}
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});

	app.on("before-quit", () => {
		void sidecarManager.stop();
	});
}
