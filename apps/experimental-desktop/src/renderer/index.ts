import "./styles.css";

const appInfo = document.querySelector<HTMLParagraphElement>("#app-info");
const selection = document.querySelector<HTMLParagraphElement>("#selection");
const openFolder = document.querySelector<HTMLButtonElement>("#open-folder");
const openFile = document.querySelector<HTMLButtonElement>("#open-file");
const openDocs = document.querySelector<HTMLButtonElement>("#open-docs");

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
}

openFolder?.addEventListener("click", async () => {
	const path = await window.experimentalDesktop.openDirectory();
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

void boot();
