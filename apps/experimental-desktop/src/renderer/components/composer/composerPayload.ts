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
	folderMode?: ComposerContextItem["folderMode"];
	folderSnapshot?: ComposerContextItem["folderSnapshot"];
};

type ComposerAttachmentPayloadPart = {
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

export function serializeComposerPayload(
	payload: ComposerPayload,
	input?: { omitNativeAttachments?: boolean },
) {
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
			const folderDetails = serializeFolderDetails(item);
			return `- ${item.type}: ${item.label}\n  ref: ${item.path}${description}${folderDetails}`;
		})
		.join("\n");
	const attachments = (
		input?.omitNativeAttachments
			? payload.attachments.filter(
					(attachment) => attachment.status === "failed",
				)
			: payload.attachments
	)
		.map((item) => {
			const ref = item.path ? `\n  ref: ${item.path}` : "";
			const status =
				item.status === "failed" && item.error
					? `\n  error: ${item.error}`
					: "";
			return `- ${item.kind}: ${item.name}${ref}${status}`;
		})
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

function serializeFolderDetails(item: ComposerContextItem) {
	const snapshot = item.folderSnapshot;
	if (!snapshot) {
		return item.folderMode ? `\n  folderMode: ${item.folderMode}` : "";
	}
	const tree = snapshot.treeLines?.length
		? `\n  tree:\n${snapshot.treeLines
				.slice(0, 80)
				.map((line) => `    ${line}`)
				.join("\n")}`
		: "";
	const included = snapshot.includedPaths?.length
		? `\n  includedPaths:\n${snapshot.includedPaths
				.slice(0, 120)
				.map((path) => `    ${path}`)
				.join("\n")}`
		: "";
	const extensions = snapshot.extensions?.length
		? `\n  extensions: ${snapshot.extensions
				.slice(0, 12)
				.map((entry) => `${entry.extension}:${entry.count}`)
				.join(", ")}`
		: "";
	const warnings = snapshot.warnings.length
		? `\n  warnings: ${snapshot.warnings.join("; ")}`
		: "";
	return `\n  folderMode: ${snapshot.mode}\n  files: ${snapshot.fileCount}\n  directories: ${snapshot.directoryCount}\n  includedFileRefs: ${snapshot.includedFileCount}\n  truncated: ${snapshot.truncated}${extensions}${warnings}${tree}${included}`;
}

function contextItemToPart(item: ComposerContextItem): ComposerPayloadPart {
	return {
		type: contextPartTypeForItem(item.type),
		label: item.label,
		path: item.path,
		description: item.description,
		folderMode: item.folderMode,
		folderSnapshot: item.folderSnapshot,
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
			return total + part.name.length + (part.path?.length ?? 0);
		}
		if (!isContextPart(part)) {
			return total;
		}
		return (
			total +
			part.label.length +
			part.path.length +
			(part.description?.length ?? 0) +
			(part.folderSnapshot?.approxChars ?? 0)
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
