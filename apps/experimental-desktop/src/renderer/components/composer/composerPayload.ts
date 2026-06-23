import {
	type ComposerMode,
	serializeComposerSendText,
} from "./composerTriggers";
import type { ComposerContextItem } from "./composerTypes";

export type ComposerPayloadPart =
	| { type: "user_text"; text: string }
	| {
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

export type ComposerPayloadMetrics = {
	itemCount: number;
	approxChars: number;
	approxTokens: number;
};

export type ComposerPayload = {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
	parts: ComposerPayloadPart[];
	metrics: ComposerPayloadMetrics;
};

export function buildComposerPayload(input: {
	mode: ComposerMode;
	text: string;
	contextItems: ComposerContextItem[];
}): ComposerPayload {
	const text = input.text.trim();
	const parts: ComposerPayloadPart[] = [
		...input.contextItems.map(contextItemToPart),
		...(text ? [{ type: "user_text" as const, text }] : []),
	];
	return {
		mode: input.mode,
		text,
		contextItems: input.contextItems,
		parts,
		metrics: estimatePayloadMetrics(parts),
	};
}

export function serializeComposerPayload(payload: ComposerPayload) {
	const requestText = serializeComposerSendText(payload.text, payload.mode);
	if (!payload.contextItems.length) {
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
	return `Context parts:\n${context}\n\nUser request:\n${requestText}`.trim();
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

function contextPartTypeForItem(
	type: ComposerContextItem["type"],
): Exclude<ComposerPayloadPart["type"], "user_text"> {
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
