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

export type CodexProviderStatus = {
	provider: {
		id: string;
		type: "codex";
		displayName: string;
		binaryPath: string;
		codexHome: string;
		shadowHome?: string;
		env?: Record<string, string>;
	};
	effectiveCodexHome: string;
	binary: {
		path: string;
		available: boolean;
		version: string | null;
		error: string | null;
	};
};

export type CodexAppServerProbe = {
	ok: boolean;
	provider: {
		id: string;
		displayName: string;
		binaryPath: string;
		codexHome: string;
		shadowHome: string | null;
		effectiveCodexHome: string;
	};
	initialized: unknown;
	account: unknown;
};

export type SessionEvent =
	| {
			id: string;
			type: "message.created";
			time: string;
			data: { text: string };
	  }
	| {
			id: string;
			type: "assistant.delta";
			time: string;
			data: { text?: string; turnId?: string; raw: unknown };
	  }
	| {
			id: string;
			type: "assistant.completed";
			time: string;
			data: { turnId?: string; raw: unknown };
	  }
	| {
			id: string;
			type: "message.failed";
			time: string;
			data: { error: string; turnId?: string; raw?: unknown };
	  }
	| {
			id: string;
			type: "request.pending";
			time: string;
			data: {
				requestId: string;
				method: string;
				requestKind:
					| "command"
					| "file-change"
					| "user-input"
					| "unknown";
				turnId?: string;
				itemId?: string;
				raw: unknown;
			};
	  }
	| {
			id: string;
			type: "request.resolved";
			time: string;
			data: { requestId: string; response: unknown };
	  }
	| {
			id: string;
			type: "provider.raw";
			time: string;
			data: { method: string; params: unknown };
	  };

export type CodexSession = {
	id: string;
	threadId?: string;
	createdAt: string;
};

export type SendSessionMessageResult = {
	accepted: true;
	turnId?: string;
};

export type CodexRuntimeMode = "read-only" | "workspace-write" | "full-access";

export type RespondSessionRequestInput =
	| { decision: "accept" | "acceptForSession" | "decline" | "cancel" }
	| { answers: Record<string, string | string[]> };

export type ExperimentalDesktopApi = {
	getAppInfo: () => Promise<AppInfo>;
	openDirectory: () => Promise<string | null>;
	openFile: () => Promise<string | null>;
	openExternal: (url: string) => Promise<void>;
	getOpenAiAuthStatus: () => Promise<OpenAiAuthStatus>;
	startOpenAiBrowserAuth: () => Promise<OpenAiAuthStart>;
	refreshOpenAiAuth: () => Promise<OpenAiAuthStatus>;
	logoutOpenAi: () => Promise<{ ok: true }>;
	getCodexProviderStatus: () => Promise<CodexProviderStatus>;
	probeCodexAppServer: () => Promise<CodexAppServerProbe>;
	createSession: (input?: {
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<CodexSession>;
	sendSessionMessage: (
		sessionId: string,
		input: { text: string; model?: string },
	) => Promise<SendSessionMessageResult>;
	respondSessionRequest: (
		sessionId: string,
		requestId: string,
		input: RespondSessionRequestInput,
	) => Promise<{ ok: true }>;
	subscribeSessionEvents: (
		sessionId: string,
		listener: (event: SessionEvent) => void,
	) => Promise<() => void>;
};
