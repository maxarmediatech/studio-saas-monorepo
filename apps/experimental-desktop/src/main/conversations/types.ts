import type { CodexRuntimeMode } from "../sidecar-codex-runtime";

export type ConversationStatus =
	| "active"
	| "idle"
	| "waiting_approval"
	| "failed"
	| "archived"
	| "deleted";

export type TurnStatus =
	| "queued"
	| "running"
	| "waiting_approval"
	| "completed"
	| "failed"
	| "canceled";

export type ApprovalStatus =
	| "pending"
	| "accepted"
	| "accepted_for_session"
	| "declined"
	| "canceled"
	| "expired"
	| "failed";

export type ApprovalKind = "command" | "file-change" | "user-input" | "unknown";

export type ConversationEvent =
	| {
			id: string;
			type: "message.created";
			time: string;
			data: { text: string; messageId: string; turnId: string };
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
				approvalId: string;
				method: string;
				requestKind: ApprovalKind;
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
			data: { requestId: string; approvalId?: string; response: unknown };
	  }
	| {
			id: string;
			type: "provider.raw";
			time: string;
			data: { method: string; params: unknown };
	  };

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
	status: ConversationStatus;
	createdAt: string;
	updatedAt: string;
	lastMessageAt?: string;
	providerThreadId?: string;
};

export type ConversationMessage = {
	id: string;
	conversationId: string;
	turnId?: string;
	ordinal: number;
	role: "user" | "assistant" | "system";
	status: "pending" | "streaming" | "completed" | "failed" | "interrupted";
	text: string;
	createdAt: string;
	updatedAt: string;
};

export type PendingApproval = {
	id: string;
	conversationId: string;
	turnId?: string;
	providerRequestId: string;
	providerItemId?: string;
	kind: ApprovalKind;
	status: ApprovalStatus;
	request: unknown;
	createdAt: string;
	expiresAt?: string;
};

export type ConversationDetail = ConversationSummary & {
	messages: ConversationMessage[];
	pendingApprovals: PendingApproval[];
};
