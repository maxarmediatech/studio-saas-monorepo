export type AppInfo = {
	name: string;
	version: string;
	platform: NodeJS.Platform;
	allowFullAccessMode: boolean;
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
		resolvedPath: string | null;
		installSource: CodexInstallSource;
	};
	versionAdvisory?: ProviderVersionAdvisory;
	updateState?: ProviderUpdateState;
};

export type ProviderVersionAdvisoryStatus =
	| "unknown"
	| "current"
	| "behind_latest";

export type ProviderVersionAdvisory = {
	status: ProviderVersionAdvisoryStatus;
	source: CodexInstallSource;
	currentVersion: string | null;
	latestVersion: string | null;
	updateCommand: string | null;
	canUpdate: boolean;
	checkedAt: string | null;
	message: string | null;
};

export type ProviderUpdateStatus =
	| "idle"
	| "queued"
	| "running"
	| "succeeded"
	| "failed"
	| "unchanged";

export type ProviderUpdateState = {
	status: ProviderUpdateStatus;
	startedAt: string | null;
	finishedAt: string | null;
	message: string | null;
	output: string | null;
};

export type CodexInstallSource =
	| "npm"
	| "pnpm"
	| "bun"
	| "brew-cask"
	| "standalone"
	| "windows-standalone"
	| "manual"
	| "unknown";

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

export type ConversationEvent =
	| {
			id: string;
			type: "message.created";
			time: string;
			data: { text: string; messageId?: string; turnId?: string };
	  }
	| {
			id: string;
			type: "assistant.delta";
			time: string;
			data: {
				text?: string;
				turnId?: string;
				providerTurnId?: string;
				messageId?: string;
				raw: unknown;
			};
	  }
	| {
			id: string;
			type: "assistant.completed";
			time: string;
			data: {
				turnId?: string;
				providerTurnId?: string;
				messageId?: string;
				raw: unknown;
			};
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
				approvalId?: string;
				method: string;
				requestKind:
					| "command"
					| "file-change"
					| "user-input"
					| "unknown";
				turnId?: string;
				providerTurnId?: string;
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
	  }
	| {
			id: string;
			type: "session.compacted";
			time: string;
			data: {
				summaryId: string;
				messageId: string;
				reason: "auto" | "manual";
				tokensBefore: number;
			};
	  };

export type CodexSession = {
	id: string;
	threadId?: string;
	createdAt: string;
};

export type SessionEvent = ConversationEvent;

export type SendSessionMessageResult = {
	accepted: true;
	turnId?: string;
};

export type CodexRuntimeMode = "read-only" | "workspace-write" | "full-access";

export type RespondSessionRequestInput =
	| { decision: "accept" | "acceptForSession" | "decline" | "cancel" }
	| { answers: Record<string, string | string[]> };

export type DraftRecord = {
	id: string;
	text: string;
	cwd?: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
	createdAt: string;
	updatedAt: string;
	promotedConversationId?: string;
};

export type ConversationSummary = {
	id: string;
	title: string;
	cwd: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
	status:
		| "active"
		| "idle"
		| "waiting_approval"
		| "failed"
		| "archived"
		| "deleted";
	createdAt: string;
	updatedAt: string;
	lastMessageAt?: string;
	providerThreadId?: string;
	providerLeafMessageId?: string;
	parentConversationId?: string;
	branchedFromMessageId?: string;
	branchedFromTurnId?: string;
	branchOriginProviderThreadId?: string;
	activeLeafMessageId?: string;
};

export type ConversationMessage = {
	id: string;
	conversationId: string;
	turnId?: string;
	parentMessageId?: string;
	ordinal: number;
	role: "user" | "assistant" | "system";
	status: "pending" | "streaming" | "completed" | "failed" | "interrupted";
	text: string;
	summaryContext?: string[];
	createdAt: string;
	updatedAt: string;
};

export type PendingApproval = {
	id: string;
	conversationId: string;
	turnId?: string;
	providerRequestId: string;
	providerItemId?: string;
	kind: "command" | "file-change" | "user-input" | "unknown";
	status:
		| "pending"
		| "accepted"
		| "accepted_for_session"
		| "declined"
		| "canceled"
		| "expired"
		| "failed";
	request: unknown;
	createdAt: string;
	expiresAt?: string;
};

export type ConversationDetail = ConversationSummary & {
	messages: ConversationMessage[];
	pendingApprovals: PendingApproval[];
};

export type ConversationTreeNode = ConversationMessage & {
	childCount: number;
	isActiveLeaf: boolean;
};

export type ForkedConversation = {
	conversation: ConversationDetail;
	copiedMessageCount: number;
};

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
	updateCodexProvider: () => Promise<CodexProviderStatus>;
	listConversations: () => Promise<ConversationSummary[]>;
	getConversation: (
		conversationId: string,
	) => Promise<ConversationDetail | undefined>;
	getConversationTree: (
		conversationId: string,
	) => Promise<ConversationTreeNode[]>;
	branchConversationFromMessage: (
		conversationId: string,
		input: { messageId: string },
	) => Promise<ConversationDetail | undefined>;
	copyConversationBranchFromMessage: (
		conversationId: string,
		input: { messageId: string },
	) => Promise<ForkedConversation>;
	createDraft: (input?: {
		text?: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<DraftRecord>;
	updateDraft: (
		draftId: string,
		input: {
			text?: string;
			cwd?: string;
			model?: string;
			runtimeMode?: CodexRuntimeMode;
		},
	) => Promise<DraftRecord>;
	promoteDraftAndSend: (input: {
		draftId?: string;
		text: string;
		cwd?: string;
		model?: string;
		runtimeMode?: CodexRuntimeMode;
	}) => Promise<ConversationDetail | undefined>;
	sendConversationMessage: (
		conversationId: string,
		input: { text: string; model?: string; runtimeMode?: CodexRuntimeMode },
	) => Promise<ConversationDetail | undefined>;
	respondApproval: (
		conversationId: string,
		requestId: string,
		input: RespondSessionRequestInput,
	) => Promise<{ ok: true }>;
	renameConversation: (
		conversationId: string,
		input: { title: string },
	) => Promise<ConversationDetail | undefined>;
	archiveConversation: (
		conversationId: string,
	) => Promise<ConversationDetail | undefined>;
	deleteConversation: (conversationId: string) => Promise<{ ok: true }>;
	subscribeConversationEvents: (
		conversationId: string,
		listener: (event: ConversationEvent) => void,
	) => Promise<() => void>;
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
