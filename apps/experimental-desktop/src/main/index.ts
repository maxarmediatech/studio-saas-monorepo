import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	app,
	BrowserWindow,
	dialog,
	ipcMain,
	shell,
	utilityProcess,
} from "electron";
import windowStateKeeper from "electron-window-state";

const currentDir = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;
let sidecar: SidecarRuntime | null = null;
let sidecarStarting: Promise<SidecarRuntime> | null = null;

type SidecarRuntime = {
	url: string;
	username: string;
	password: string;
	stop: () => Promise<void>;
};

type SidecarMessage =
	| { type: "ready" }
	| { type: "stopped" }
	| { type: "error"; error: { message: string; stack?: string } };

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

	ipcMain.handle("sidecar:get-status", async () => {
		const runtime = await ensureSidecar();
		return sidecarFetch(runtime, "/auth/openai/status");
	});

	ipcMain.handle("sidecar:start-openai-browser-auth", async () => {
		const runtime = await ensureSidecar();
		return sidecarFetch(runtime, "/auth/openai/browser/start", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:refresh-openai", async () => {
		const runtime = await ensureSidecar();
		return sidecarFetch(runtime, "/auth/openai/refresh", {
			method: "POST",
		});
	});

	ipcMain.handle("sidecar:logout-openai", async () => {
		const runtime = await ensureSidecar();
		return sidecarFetch(runtime, "/auth/openai/logout", { method: "POST" });
	});
}

async function ensureSidecar() {
	if (sidecar) {
		return sidecar;
	}
	sidecarStarting ??= spawnSidecar().finally(() => {
		sidecarStarting = null;
	});
	sidecar = await sidecarStarting;
	return sidecar;
}

async function spawnSidecar(): Promise<SidecarRuntime> {
	const port = await getFreePort();
	const hostname = "127.0.0.1";
	const username = "experimental";
	const password = randomUUID();
	const url = `http://${hostname}:${port}`;
	const sidecarPath = join(currentDir, "sidecar.js");
	const child = utilityProcess.fork(sidecarPath, [], {
		serviceName: "experimental desktop sidecar",
		stdio: "pipe",
	});

	child.stdout?.on("data", (chunk: Buffer) => {
		console.log(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
	});
	child.stderr?.on("data", (chunk: Buffer) => {
		console.warn(`[sidecar] ${chunk.toString("utf8").trimEnd()}`);
	});
	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			child.kill();
			reject(new Error("Sidecar did not start within 30 seconds"));
		}, 30_000);

		const cleanup = () => {
			clearTimeout(timeout);
			child.off("message", onMessage);
			child.off("exit", onExit);
		};

		const onExit = (code: number) => {
			sidecar = null;
			if (settled) {
				return;
			}
			settled = true;
			cleanup();
			reject(new Error(`Sidecar exited before ready with code ${code}`));
		};

		const onMessage = (message: SidecarMessage) => {
			if (settled) {
				return;
			}
			if (message.type === "ready") {
				settled = true;
				cleanup();
				resolve();
			}
			if (message.type === "error") {
				settled = true;
				cleanup();
				reject(
					Object.assign(new Error(message.error.message), {
						stack: message.error.stack,
					}),
				);
			}
		};

		child.on("message", onMessage);
		child.once("exit", onExit);
		child.postMessage({
			type: "start",
			hostname,
			port,
			username,
			password,
			userDataPath: app.getPath("userData"),
		});
	});

	child.once("exit", () => {
		sidecar = null;
	});

	return {
		url,
		username,
		password,
		stop: async () => {
			child.postMessage({ type: "stop" });
			await new Promise<void>((resolve) => {
				const timeout = setTimeout(() => {
					child.kill();
					resolve();
				}, 5000);
				child.once("exit", () => {
					clearTimeout(timeout);
					resolve();
				});
			});
		},
	};
}

async function sidecarFetch(
	runtime: SidecarRuntime,
	path: string,
	init: RequestInit = {},
) {
	const response = await fetch(new URL(path, runtime.url), {
		...init,
		headers: {
			...init.headers,
			authorization: `Basic ${Buffer.from(`${runtime.username}:${runtime.password}`).toString("base64")}`,
		},
	});
	const body = (await response.json()) as unknown;
	if (!response.ok) {
		throw new Error(
			typeof body === "object" && body && "error" in body
				? String(body.error)
				: response.statusText,
		);
	}
	return body;
}

async function getFreePort() {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (!address || typeof address !== "object") {
				server.close();
				reject(new Error("Failed to resolve free port"));
				return;
			}
			const { port } = address;
			server.close(() => resolve(port));
		});
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

	app.on("before-quit", () => {
		void sidecar?.stop();
	});
}
