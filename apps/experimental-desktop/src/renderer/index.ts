import "./styles.css";

const appInfo = document.querySelector<HTMLParagraphElement>("#app-info");
const selection = document.querySelector<HTMLParagraphElement>("#selection");
const openFolder = document.querySelector<HTMLButtonElement>("#open-folder");
const openFile = document.querySelector<HTMLButtonElement>("#open-file");
const openDocs = document.querySelector<HTMLButtonElement>("#open-docs");
const openAiStatus =
	document.querySelector<HTMLParagraphElement>("#openai-status");
const openAiDetail =
	document.querySelector<HTMLParagraphElement>("#openai-detail");
const connectOpenAi =
	document.querySelector<HTMLButtonElement>("#connect-openai");
const refreshOpenAi =
	document.querySelector<HTMLButtonElement>("#refresh-openai");
const logoutOpenAi =
	document.querySelector<HTMLButtonElement>("#logout-openai");
let authPoll: number | undefined;

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
	await refreshOpenAiStatus();
}

async function refreshOpenAiStatus() {
	if (openAiStatus) {
		openAiStatus.textContent = "Checking...";
	}

	try {
		const status = await window.experimentalDesktop.getOpenAiAuthStatus();
		if (openAiStatus) {
			openAiStatus.textContent = status.connected
				? "Connected"
				: status.expired
					? "Expired"
					: "Not connected";
		}
		if (openAiDetail) {
			openAiDetail.textContent = status.connected
				? `Account ${status.accountId ?? "unknown"} · expires ${status.expires ? new Date(status.expires).toLocaleString() : "unknown"}`
				: status.expired
					? "Token exists but is expired. Refresh or reconnect."
					: "Use browser OAuth to connect a ChatGPT Pro/Plus account.";
		}
		return status.connected;
	} catch (error) {
		if (openAiStatus) {
			openAiStatus.textContent = "Sidecar error";
		}
		if (openAiDetail) {
			openAiDetail.textContent =
				error instanceof Error ? error.message : String(error);
		}
		return false;
	}
}

function startAuthPolling() {
	window.clearInterval(authPoll);
	const startedAt = Date.now();
	authPoll = window.setInterval(async () => {
		const connected = await refreshOpenAiStatus();
		const timedOut = Date.now() - startedAt > 5 * 60 * 1000;
		if (connected || timedOut) {
			window.clearInterval(authPoll);
			authPoll = undefined;
		}
	}, 2000);
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

connectOpenAi?.addEventListener("click", async () => {
	if (openAiStatus) {
		openAiStatus.textContent = "Starting browser OAuth...";
	}
	const auth = await window.experimentalDesktop.startOpenAiBrowserAuth();
	if (openAiDetail) {
		openAiDetail.textContent = auth.instructions;
	}
	await window.experimentalDesktop.openExternal(auth.url);
	startAuthPolling();
});

refreshOpenAi?.addEventListener("click", () => {
	void window.experimentalDesktop
		.refreshOpenAiAuth()
		.catch(() => undefined)
		.finally(() => void refreshOpenAiStatus());
});

logoutOpenAi?.addEventListener("click", async () => {
	await window.experimentalDesktop.logoutOpenAi();
	await refreshOpenAiStatus();
});

void boot();
