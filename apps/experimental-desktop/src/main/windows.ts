import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BrowserWindow } from "electron";
import windowStateKeeper from "electron-window-state";

const currentDir = dirname(fileURLToPath(import.meta.url));

export function createMainWindow() {
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

	return win;
}
