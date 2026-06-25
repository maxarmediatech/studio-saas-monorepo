import { describe, expect, it } from "vitest";
import {
	buildProviderHandoffPrompt,
	buildProviderNativeInput,
} from "../provider-context";
import type { ConversationMessage } from "../types";

describe("buildProviderHandoffPrompt", () => {
	it("returns the user text when there is no stored context", () => {
		expect(
			buildProviderHandoffPrompt({ messages: [] }, "what happened?"),
		).toBe("what happened?");
	});

	it("builds a DB-backed handoff prompt for resumed follow-ups", () => {
		const prompt = buildProviderHandoffPrompt(
			{
				messages: [
					message("m1", "user", "what is in this folder?"),
					message(
						"m2",
						"assistant",
						"The folder contains agency sop.md",
					),
				],
			},
			"summarise this",
		);

		expect(prompt).toContain(
			"Continue from this local conversation transcript.",
		);
		expect(prompt).toContain("USER: what is in this folder?");
		expect(prompt).toContain(
			"ASSISTANT: The folder contains agency sop.md",
		);
		expect(prompt).toContain("USER: summarise this");
		expect(prompt).toMatch(/answer only the latest user message/i);
	});

	it("keeps compaction summaries and only the retained transcript tail", () => {
		const prompt = buildProviderHandoffPrompt(
			{
				messages: [
					message("old-user", "user", "old request"),
					message("tail-user", "user", "retained request"),
					message("tail-assistant", "assistant", "retained answer"),
				],
				compactionSummary: {
					id: "summary-1",
					conversationId: "conversation-1",
					type: "compaction",
					summary: "Earlier work: listed and inspected the folder.",
					tailStartMessageId: "tail-user",
					createdAt: "2026-06-24T00:00:00.000Z",
				},
			},
			"continue",
		);

		expect(prompt).toContain("SESSION CHECKPOINT:");
		expect(prompt).toContain(
			"Earlier work: listed and inspected the folder.",
		);
		expect(prompt).not.toContain("old request");
		expect(prompt).toContain("USER: retained request");
		expect(prompt).toContain("ASSISTANT: retained answer");
		expect(prompt).toContain("USER: continue");
	});

	it("replaces provider-native text with the DB-backed handoff text", () => {
		expect(
			buildProviderNativeInput("full handoff prompt", [
				{ type: "text", text: "latest prompt only" },
				{
					type: "local_file",
					path: "/tmp/source.txt",
					name: "source.txt",
					mimeType: "text/plain",
				},
			]),
		).toEqual([
			{ type: "text", text: "full handoff prompt" },
			{
				type: "local_file",
				path: "/tmp/source.txt",
				name: "source.txt",
				mimeType: "text/plain",
			},
		]);
	});
});

function message(
	id: string,
	role: ConversationMessage["role"],
	text: string,
): ConversationMessage {
	return {
		id,
		conversationId: "conversation-1",
		ordinal: 0,
		role,
		status: "completed",
		text,
		createdAt: "2026-06-24T00:00:00.000Z",
		updatedAt: "2026-06-24T00:00:00.000Z",
	};
}
