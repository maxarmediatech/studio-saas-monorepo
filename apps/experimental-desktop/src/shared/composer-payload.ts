import type {
	ComposerAttachment,
	ComposerContextItem,
	ComposerMode,
} from "./composer-types";

export type ComposerContextPayloadPart = {
	type:
		| "context_file"
		| "context_directory"
		| "context_workspace"
		| "context_skill"
		| "context_terminal";
	label: string;
	path: string;
	description?: string;
	folderMode?: ComposerContextItem["folderMode"];
	folderSnapshot?: ComposerContextItem["folderSnapshot"];
};

export type ComposerAttachmentPayloadPart = {
	type: "attachment_file" | "attachment_image";
	id: string;
	name: string;
	path?: string;
	mimeType?: string;
	size?: number;
};

export type ComposerPayloadPart =
	| { type: "user_text"; text: string }
	| ComposerAttachmentPayloadPart
	| ComposerContextPayloadPart;

export type ComposerPayloadMetrics = {
	itemCount: number;
	approxChars: number;
	approxTokens: number;
};

export type ComposerPayload = {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
	attachments: ComposerAttachment[];
	parts: ComposerPayloadPart[];
	metrics: ComposerPayloadMetrics;
};
