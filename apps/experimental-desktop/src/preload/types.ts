export type AppInfo = {
	name: string;
	version: string;
	platform: NodeJS.Platform;
};

export type ExperimentalDesktopApi = {
	getAppInfo: () => Promise<AppInfo>;
	openDirectory: () => Promise<string | null>;
	openFile: () => Promise<string | null>;
	openExternal: (url: string) => Promise<void>;
};
