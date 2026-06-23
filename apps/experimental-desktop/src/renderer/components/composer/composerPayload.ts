import {
	type ComposerMode,
	serializeComposerSendText,
} from "./composerTriggers";
import type { ComposerAttachment, ComposerContextItem } from "./composerTypes";

type ComposerContextPayloadPart = {
	type:
		| "context_file"
		| "context_directory"
		| "context_workspace"
		| "context_skill"
		| "context_terminal";
	label: string;
	path: string;
	description?: string;
};

type ComposerAttachmentPayloadPart = {
	type: "attachment_file" | "attachment_image";
	id: string;
	name: string;
	path: string;
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

export function buildComposerPayload(input: {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
	attachments?: ComposerAttachment[];
}): ComposerPayload {
	const text = input.text.trim();
	const parts: ComposerPayloadPart[] = [
		...input.contextItems.map(contextItemToPart),
		...(input.attachments ?? []).map(attachmentToPart),
		...(text ? [{ type: "user_text" as const, text }] : []),
	];
	return {
		mode: input.mode,
		text,
		contextItems: input.contextItems,
		attachments: input.attachments ?? [],
		parts,
		metrics: estimatePayloadMetrics(parts),
	};
}

export function serializeComposerPayload(payload: ComposerPayload) {
	const requestText = serializeComposerSendText(
		payload.text || defaultRequestForMode(payload.mode),
		payload.mode,
	);
	if (!payload.contextItems.length && !payload.attachments.length) {
		return requestText.trim();
	}
	const context = payload.contextItems
		.map((item) => {
			const description = item.description
				? `\n  description: ${item.description}`
				: "";
			return `- ${item.type}: ${item.label}\n  ref: ${item.path}${description}`;
		})
		.join("\n");
	const attachments = payload.attachments
		.map((item) => `- ${item.kind}: ${item.name}\n  ref: ${item.path}`)
		.join("\n");
	return [
		context ? `Context parts:\n${context}` : "",
		attachments ? `Attachments:\n${attachments}` : "",
		`User request:\n${requestText}`,
	]
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

export function estimateComposerContextMetrics(items: ComposerContextItem[]) {
	return estimatePayloadMetrics(items.map(contextItemToPart));
}

function contextItemToPart(item: ComposerContextItem): ComposerPayloadPart {
	return {
		type: contextPartTypeForItem(item.type),
		label: item.label,
		path: item.path,
		description: item.description,
	};
}

function attachmentToPart(item: ComposerAttachment): ComposerPayloadPart {
	return {
		type: item.kind === "image" ? "attachment_image" : "attachment_file",
		id: item.id,
		name: item.name,
		path: item.path,
		mimeType: item.mimeType,
		size: item.size,
	};
}

function contextPartTypeForItem(
	type: ComposerContextItem["type"],
): ComposerContextPayloadPart["type"] {
	switch (type) {
		case "file":
			return "context_file";
		case "directory":
			return "context_directory";
		case "workspace":
			return "context_workspace";
		case "skill":
			return "context_skill";
		case "terminal":
			return "context_terminal";
	}
}

function estimatePayloadMetrics(parts: ComposerPayloadPart[]) {
	const approxChars = parts.reduce((total, part) => {
		if (part.type === "user_text") {
			return total + part.text.length;
		}
		if (isAttachmentPart(part)) {
			return total + part.name.length + part.path.length;
		}
		if (!isContextPart(part)) {
			return total;
		}
		return (
			total +
			part.label.length +
			part.path.length +
			(part.description?.length ?? 0)
		);
	}, 0);
	return {
		itemCount: parts.filter((part) => part.type !== "user_text").length,
		approxChars,
		approxTokens: Math.ceil(approxChars / 4),
	};
}

function isAttachmentPart(
	part: ComposerPayloadPart,
): part is ComposerAttachmentPayloadPart {
	return part.type === "attachment_file" || part.type === "attachment_image";
}

function isContextPart(
	part: ComposerPayloadPart,
): part is ComposerContextPayloadPart {
	return part.type.startsWith("context_");
}

function defaultRequestForMode(mode: ComposerMode) {
	switch (mode) {
		case "ask":
			return "Answer using the selected context.";
		case "plan":
			return "Plan changes for the selected context.";
		case "build":
			return "Improve or implement using the selected context.";
		case "review":
			return "Review the selected context and report issues.";
		case "shell":
			return "";
	}
}
