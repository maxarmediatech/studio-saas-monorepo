import type { ConversationMessage } from "./types";

const SYSTEM_PROMPT = [
	"You summarize coding-agent conversations for safe handoff and branch replay.",
	"Do not continue the conversation.",
	"Preserve exact file paths, function names, commands, errors, IDs, and user preferences.",
	"Be compact, factual, and structured.",
].join(" ");

const MAX_SERIALIZED_MESSAGE_CHARS = 3000;

export type SummaryPurpose = "branch" | "fork";

export type SummaryRequest = {
	model?: string;
	purpose: SummaryPurpose;
	messages: ConversationMessage[];
};

export function buildSummaryRequest(input: SummaryRequest) {
	return {
		model: input.model ?? "gpt-5.4-mini",
		instructions: SYSTEM_PROMPT,
		input: [
			{
				role: "user",
				content: [
					{
						type: "input_text",
						text: buildSummaryPrompt(input),
					},
				],
			},
		],
		max_output_tokens: 2048,
		store: false,
		stream: true,
	};
}

export function estimateTokens(messages: ConversationMessage[]) {
	const chars = messages.reduce(
		(total, message) => total + message.text.length,
		0,
	);
	return Math.ceil(chars / 4);
}

function buildSummaryPrompt(input: SummaryRequest) {
	const heading =
		input.purpose === "fork"
			? "Create a handoff summary for a copied branch."
			: "Create a branch checkpoint summary.";
	return [
		heading,
		"",
		"Return exactly these sections:",
		"## Goal",
		"## Constraints & Preferences",
		"## Progress",
		"## Key Decisions",
		"## Next Steps",
		"## Critical Context",
		"",
		"Conversation:",
		serializeMessages(input.messages),
	].join("\n");
}

function serializeMessages(messages: ConversationMessage[]) {
	const serialized = messages
		.map((message) =>
			[
				`[${message.role.toUpperCase()} ${message.id}]`,
				message.text.trim() || "(empty)",
			].join("\n"),
		)
		.join("\n\n");
	if (serialized.length <= MAX_SERIALIZED_MESSAGE_CHARS) {
		return serialized;
	}
	return [
		"(earlier transcript truncated for summary budget)",
		serialized.slice(-MAX_SERIALIZED_MESSAGE_CHARS),
	].join("\n");
}
