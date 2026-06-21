export type AppInfo = {
	name: string;
	version: string;
	platform: NodeJS.Platform;
};

export type OpenAiAuthStatus = {
	connected: boolean;
	expired: boolean;
	accountId: string | null;
	expires: number | null;
	updatedAt: string | null;
};

export type OpenAiAuthStart = {
	url: string;
	method: "auto";
	instructions: string;
};

export type CodexTestResponse = unknown;

export type ExperimentalDesktopApi = {
	getAppInfo: () => Promise<AppInfo>;
	openDirectory: () => Promise<string | null>;
	openFile: () => Promise<string | null>;
	openExternal: (url: string) => Promise<void>;
	getOpenAiAuthStatus: () => Promise<OpenAiAuthStatus>;
	startOpenAiBrowserAuth: () => Promise<OpenAiAuthStart>;
	refreshOpenAiAuth: () => Promise<OpenAiAuthStatus>;
	logoutOpenAi: () => Promise<{ ok: true }>;
	sendCodexTest?: () => Promise<CodexTestResponse>;
};
