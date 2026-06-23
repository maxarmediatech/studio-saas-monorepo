import { describe, expect, it } from "vitest";
import {
	composerDraftToPersistInput,
	createComposerDraftPersistKey,
	shouldPersistComposerDraft,
} from "../composerDraftSync";
import { createComposerDraft } from "../composerDraftTypes";

function draft(input?: Partial<Parameters<typeof createComposerDraft>[0]>) {
	return createComposerDraft({
		text: "",
		mode: "ask",
		model: "gpt-5.4-mini",
		runtimeMode: "read-only",
		contextItems: [],
		attachments: [],
		updatedAt: 1,
		...input,
	});
}

describe("shouldPersistComposerDraft", () => {
	it("does not persist empty new drafts", () => {
		expect(shouldPersistComposerDraft({ draft: draft() })).toBe(false);
	});

	it("persists empty drafts when a durable draft already exists", () => {
		expect(
			shouldPersistComposerDraft({
				draft: draft(),
				draftId: "draft-1",
			}),
		).toBe(true);
	});

	it("persists text, context, and attachment drafts", () => {
		expect(
			shouldPersistComposerDraft({ draft: draft({ text: "hello" }) }),
		).toBe(true);
		expect(
			shouldPersistComposerDraft({
				draft: draft({
					contextItems: [
						{ type: "file", label: "a.ts", path: "/tmp/a.ts" },
					],
				}),
			}),
		).toBe(true);
		expect(
			shouldPersistComposerDraft({
				draft: draft({
					attachments: [
						{
							id: "attachment-1",
							kind: "file",
							name: "a.txt",
							path: "/tmp/a.txt",
						},
					],
				}),
			}),
		).toBe(true);
	});

	it("does not persist once route/session is a conversation", () => {
		expect(
			shouldPersistComposerDraft({
				draft: draft({ text: "hello" }),
				conversationId: "conversation-1",
			}),
		).toBe(false);
	});
});

describe("composerDraftToPersistInput", () => {
	it("builds the draft persistence payload from the live draft", () => {
		const input = composerDraftToPersistInput(
			draft({
				text: "  hello  ",
				mode: "plan",
				model: "gpt-5.4",
				runtimeMode: "workspace-write",
			}),
		);

		expect(input.model).toBe("gpt-5.4");
		expect(input.runtimeMode).toBe("workspace-write");
		expect(input.payload.mode).toBe("plan");
		expect(input.payload.text).toBe("hello");
		expect(input.payload.parts).toEqual([
			{ type: "user_text", text: "hello" },
		]);
	});
});

describe("createComposerDraftPersistKey", () => {
	it("changes when the draft scope changes", () => {
		const currentDraft = draft({ text: "hello" });

		expect(
			createComposerDraftPersistKey({
				draft: currentDraft,
				scopeKey: "/tmp/a",
			}),
		).not.toBe(
			createComposerDraftPersistKey({
				draft: currentDraft,
				scopeKey: "/tmp/b",
			}),
		);
	});
});
