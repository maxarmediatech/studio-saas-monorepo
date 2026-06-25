import type { CodexRuntimeMode, SessionEvent } from "../../preload/types";

export type ThemeMode = "dark" | "light";

export type TranscriptItem =
	| {
			id: string;
			type: "user";
			text: string;
			time: string;
	  }
	| {
			id: string;
			type: "assistant";
			text: string;
			status: "streaming" | "done" | "failed" | "interrupted";
			turnId?: string;
			time: string;
			startedAt?: string;
			completedAt?: string;
	  }
	| {
			id: string;
			type: "approval";
			requestId: string;
			requestKind: "command" | "file-change" | "user-input" | "unknown";
			time: string;
	  }
	| {
			id: string;
			type: "system";
			text: string;
			time: string;
	  };

export type PendingRequest = Extract<SessionEvent, { type: "request.pending" }>;

export type RuntimeOption = {
	value: CodexRuntimeMode;
	label: string;
};
