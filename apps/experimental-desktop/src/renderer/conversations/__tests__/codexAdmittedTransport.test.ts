import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../components/composer/composerPayload";
import { admitComposerRequest } from "../../components/composer/core/composerSendController";
import { toCodexAdmittedSendInput } from "../codexAdmittedTransport";

describe("toCodexAdmittedSendInput", () => {
	it("maps an admitted request to the legacy Codex IPC shape", () => {
		const admission = admitComposerRequest({
			payload: buildComposerPayload({
				mode: "build",
				text: "Patch the bug",
				contextItems: [],
				attachments: [],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "workspace-write",
			createId: () => "admitted-1",
		});

		expect(admission.ok).toBe(true);
		if (!admission.ok) {
			return;
		}

		const input = toCodexAdmittedSendInput(admission.request);

		expect(input.model).toBe("gpt-5.4-mini");
		expect(input.runtimeMode).toBe("workspace-write");
		expect(input.nativeInput[0]).toEqual({
			type: "text",
			text: "Make the requested changes, then run the relevant validation:\n\nPatch the bug",
		});
		expect(input.payload).toMatchObject({
			admittedRequest: {
				id: "admitted-1",
				requestParts: [{ type: "text", text: "Patch the bug" }],
				admission: {
					mode: "build",
				},
			},
		});
	});
});
