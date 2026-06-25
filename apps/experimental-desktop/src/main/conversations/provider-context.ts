import type {
	ConversationCheckpointSummary,
	ConversationMessage,
} from "./types";

export type ProviderContextSource = {
	messages: ConversationMessage[];
	compactionSummary?: ConversationCheckpointSummary;
	branchSummary?: ConversationCheckpointSummary;
	forkSummary?: ConversationCheckpointSummary;
};

export function buildProviderHandoffPrompt(
	source: ProviderContextSource,
	userText: string,
) {
	if (source.messages.length === 0) {
		return userText;
	}
	const replayBoundarySummary =
		source.compactionSummary ?? source.branchSummary ?? source.forkSummary;
	const boundaryId = replayBoundarySummary
		? replayBoundaryId(replayBoundarySummary)
		: undefined;
	const boundaryIndex = boundaryId
		? source.messages.findIndex((message) => message.id === boundaryId)
		: -1;
	const transcriptMessages =
		replayBoundarySummary && boundaryIndex >= 0
			? source.messages.slice(
					replayBoundarySummary.type === "compaction"
						? boundaryIndex
						: boundaryIndex + 1,
				)
			: source.messages.slice(-12);
	const transcript = transcriptMessages
		.map(formatProviderMessage)
		.join("\n\n");
	const prompt = [
		source.compactionSummary
			? "Continue this local smart-agent session from the compacted checkpoint."
			: "Continue from this local conversation transcript.",
		"Use the checkpoint, branch context, and recent transcript as context, but answer only the latest user message.",
		"",
	];
	if (source.compactionSummary) {
		prompt.push(
			"SESSION CHECKPOINT:",
			source.compactionSummary.summary,
			"",
		);
	}
	if (source.branchSummary) {
		prompt.push(
			"ABANDONED BRANCH CONTEXT:",
			source.branchSummary.summary,
			"",
		);
	}
	if (source.forkSummary) {
		prompt.push("FORK HANDOFF CONTEXT:", source.forkSummary.summary, "");
	}
	if (
		!source.compactionSummary &&
		!source.branchSummary &&
		!source.forkSummary &&
		replayBoundarySummary
	) {
		prompt.push("CHECKPOINT SUMMARY:", replayBoundarySummary.summary, "");
	}
	if (transcript) {
		prompt.push("RECENT TRANSCRIPT:", transcript, "");
	}
	prompt.push(`USER: ${userText}`);
	return prompt.join("\n");
}

export function buildProviderNativeInput(
	text: string,
	nativeInput?: unknown[],
) {
	if (!nativeInput?.length) {
		return undefined;
	}
	return [
		{ type: "text", text },
		...nativeInput.filter((part) => {
			if (!part || typeof part !== "object" || Array.isArray(part)) {
				return true;
			}
			return (part as Record<string, unknown>).type !== "text";
		}),
	];
}

export function replayBoundaryId(summary: ConversationCheckpointSummary) {
	return summary.type === "compaction"
		? (summary.tailStartMessageId ?? summary.firstKeptMessageId)
		: (summary.checkpointMessageId ?? summary.firstKeptMessageId);
}

function formatProviderMessage(message: ConversationMessage) {
	const lines = [
		`${message.role.toUpperCase()}: ${message.text.trim() || "(empty)"}`,
	];
	if (message.summaryContext?.length) {
		lines.push("Context:", ...message.summaryContext);
	}
	return lines.join("\n");
}
