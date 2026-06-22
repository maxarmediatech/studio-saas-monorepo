import type { ConversationMessage } from "./types";

const SYSTEM_PROMPT = [
	"You compact coding-agent conversations into durable session memory.",
	"Do not continue the conversation or invent work.",
	"Preserve exact file paths, function names, commands, errors, IDs, approvals, and user preferences.",
	"Be compact, factual, structured, and useful for safely resuming agent work.",
].join(" ");

const MAX_BRANCH_SERIALIZED_MESSAGE_CHARS = 3000;
export const MAX_COMPACTION_SERIALIZED_MESSAGE_CHARS = 40_000;
const SERIALIZED_MESSAGE_OVERHEAD_CHARS = 128;
const MIN_COMPACTION_TEXT_CHARS = 1000;

export type SummaryPurpose = "branch" | "fork" | "compaction";

export type SummaryRequest = {
	model?: string;
	purpose: SummaryPurpose;
	messages: ConversationMessage[];
	previousSummary?: string;
};

export function buildSummaryRequest(input: SummaryRequest) {
	return {
		model: input.model ?? "gpt-5.4-mini",
		instructions: SYSTEM_PROMPT,
		input: [
			{
				role: "user",
				content: buildSummaryPrompt(input),
			},
		],
		max_output_tokens: input.purpose === "compaction" ? 4096 : 2048,
	};
}

export function estimateTokens(messages: ConversationMessage[]) {
	const chars = messages.reduce(
		(total, message) =>
			total +
			message.text.length +
			(message.summaryContext?.join("\n").length ?? 0),
		0,
	);
	return Math.ceil(chars / 4);
}

export function chunkMessagesForCompaction(
	messages: ConversationMessage[],
	maxChars = MAX_COMPACTION_SERIALIZED_MESSAGE_CHARS,
) {
	const chunks: ConversationMessage[][] = [];
	let current: ConversationMessage[] = [];
	let currentChars = 0;
	for (const message of messages) {
		for (const part of splitOversizedMessage(message, maxChars)) {
			const chars = estimateSerializedMessageChars(part);
			if (current.length > 0 && currentChars + chars > maxChars) {
				chunks.push(current);
				current = [];
				currentChars = 0;
			}
			current.push(part);
			currentChars += chars;
		}
	}
	if (current.length > 0) {
		chunks.push(current);
	}
	return chunks;
}

function buildSummaryPrompt(input: SummaryRequest) {
	if (input.purpose === "compaction") {
		return buildCompactionPrompt(input);
	}
	const heading =
		input.purpose === "fork"
			? "Create a handoff summary for a copied branch."
			: "Create an abandoned-branch summary for work left behind while switching branches.";
	return [
		heading,
		"",
		"Return exactly these sections:",
		"## Goal",
		"## Constraints & Preferences",
		"## Progress",
		"## Tool / Approval Context",
		"## Key Decisions",
		"## Next Steps",
		"## Critical Context",
		"",
		"Conversation:",
		serializeMessages(input.messages, MAX_BRANCH_SERIALIZED_MESSAGE_CHARS),
	].join("\n");
}

function buildCompactionPrompt(input: SummaryRequest) {
	return [
		input.previousSummary?.trim()
			? "Update the previous session checkpoint with the new conversation segment. Preserve still-true details, remove stale details, and merge in new facts."
			: "Create a durable session checkpoint for this coding-agent conversation.",
		"",
		"Return exactly these sections:",
		"## Goal",
		"## User Preferences",
		"## Current State",
		"## Completed Work",
		"## Open Work",
		"## Decisions",
		"## Files & Code",
		"## Commands & Errors",
		"## Approvals / Permissions",
		"## Next Actions",
		"## Critical Context",
		"",
		input.previousSummary?.trim()
			? ["Previous checkpoint:", input.previousSummary.trim(), ""].join(
					"\n",
				)
			: "",
		"New conversation segment:",
		serializeMessages(
			input.messages,
			MAX_COMPACTION_SERIALIZED_MESSAGE_CHARS,
		),
	].join("\n");
}

function serializeMessages(messages: ConversationMessage[], maxChars: number) {
	const serialized = messages
		.map((message) =>
			[
				`[${message.role.toUpperCase()} ${message.id}]`,
				message.text.trim() || "(empty)",
				...(message.summaryContext?.length
					? ["", "Context:", ...message.summaryContext]
					: []),
			].join("\n"),
		)
		.join("\n\n");
	if (serialized.length <= maxChars) {
		return serialized;
	}
	return [
		"(earlier transcript truncated for summary budget)",
		serialized.slice(-maxChars),
	].join("\n");
}

function splitOversizedMessage(message: ConversationMessage, maxChars: number) {
	if (estimateSerializedMessageChars(message) <= maxChars) {
		return [message];
	}
	const baseChars =
		SERIALIZED_MESSAGE_OVERHEAD_CHARS +
		message.role.length +
		message.id.length;
	const summaryContext = fitSummaryContext(
		message.summaryContext ?? [],
		Math.max(0, maxChars - baseChars - MIN_COMPACTION_TEXT_CHARS),
	);
	const maxTextChars = Math.max(
		1,
		maxChars - baseChars - serializedContextChars(summaryContext),
	);
	if (message.text.length === 0) {
		return [{ ...message, summaryContext }];
	}
	const parts: ConversationMessage[] = [];
	for (let start = 0; start < message.text.length; start += maxTextChars) {
		const partIndex = parts.length + 1;
		parts.push({
			...message,
			id: `${message.id}:chunk-${partIndex}`,
			text: message.text.slice(start, start + maxTextChars),
			summaryContext: partIndex === 1 ? summaryContext : undefined,
		});
	}
	return parts;
}

function estimateSerializedMessageChars(message: ConversationMessage) {
	return (
		message.text.length +
		serializedContextChars(message.summaryContext ?? []) +
		message.role.length +
		message.id.length +
		SERIALIZED_MESSAGE_OVERHEAD_CHARS
	);
}

function serializedContextChars(summaryContext?: string[]) {
	return summaryContext && summaryContext.length > 0
		? summaryContext.join("\n").length
		: 0;
}

function fitSummaryContext(summaryContext: string[], maxChars: number) {
	if (maxChars <= 0 || summaryContext.length === 0) {
		return undefined;
	}
	const kept: string[] = [];
	let usedChars = 0;
	for (const item of summaryContext) {
		const remainingChars = maxChars - usedChars;
		if (remainingChars <= 0) {
			break;
		}
		const separatorChars = kept.length > 0 ? 1 : 0;
		if (item.length + separatorChars <= remainingChars) {
			kept.push(item);
			usedChars += item.length + separatorChars;
			continue;
		}
		if (remainingChars > separatorChars + 20) {
			kept.push(`${item.slice(0, remainingChars - separatorChars - 1)}…`);
		}
		break;
	}
	return kept.length > 0 ? kept : undefined;
}
