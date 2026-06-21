import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import windowStateKeeper from "electron-window-state";

const currentDir = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
	const windowState = windowStateKeeper({
		defaultWidth: 1180,
		defaultHeight: 760,
	});

	const win = new BrowserWindow({
		x: windowState.x,
		y: windowState.y,
		width: windowState.width,
		height: windowState.height,
		minWidth: 860,
		minHeight: 560,
		show: false,
		autoHideMenuBar: true,
		title: "Experimental Desktop",
		backgroundColor: "#101114",
		...(process.platform === "darwin"
			? {
					titleBarStyle: "hiddenInset" as const,
				}
			: {}),
		webPreferences: {
			preload: join(currentDir, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
		},
	});

	windowState.manage(win);

	if (process.env.ELECTRON_RENDERER_URL) {
		void win.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		void win.loadFile(join(currentDir, "../renderer/index.html"));
	}

	win.once("ready-to-show", () => {
		win.show();
	});

	win.on("closed", () => {
		if (mainWindow === win) {
			mainWindow = null;
		}
	});

	mainWindow = win;
}

function registerIpcHandlers() {
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
}

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
		registerIpcHandlers();
		createMainWindow();
	});

	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createMainWindow();
		}
	});

	app.on("window-all-closed", () => {
		if (process.platform !== "darwin") {
			app.quit();
		}
	});
}
