import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../composerPayload";
import { admitComposerRequest } from "../composerSendController";

describe("admitComposerRequest", () => {
	it("produces an admitted Codex request for a valid prompt", () => {
		const result = admitComposerRequest({
			payload: buildComposerPayload({
				mode: "ask",
				text: "Explain this",
				contextItems: [],
				attachments: [],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "workspace-write",
			createId: () => "admitted-1",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) {
			return;
		}
		expect(result.request.id).toBe("admitted-1");
		expect(result.request.providerInput.provider).toBe("codex");
		expect(result.request.providerInput.runtimeMode).toBe("read-only");
		expect(result.request.requestParts).toEqual([
			{ type: "text", text: "Explain this" },
		]);
	});

	it("rejects failed attachments before transport", () => {
		const result = admitComposerRequest({
			payload: buildComposerPayload({
				mode: "ask",
				text: "Use this file",
				contextItems: [],
				attachments: [
					{
						id: "attachment-1",
						kind: "file",
						name: "broken.txt",
						status: "failed",
						error: "too large",
					},
				],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.reason).toBe("Resolve attachments before sending.");
		expect(result.blocks).toEqual(["broken.txt: too large"]);
	});

	it("rejects pathless attachments before transport", () => {
		const result = admitComposerRequest({
			payload: buildComposerPayload({
				mode: "ask",
				text: "Use this file",
				contextItems: [],
				attachments: [
					{
						id: "attachment-1",
						kind: "file",
						name: "missing.txt",
						status: "ready",
					},
				],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.blocks).toEqual(["missing.txt: missing path"]);
	});

	it("blocks shell requests with context and attachments", () => {
		const result = admitComposerRequest({
			payload: buildComposerPayload({
				mode: "shell",
				text: "ls",
				contextItems: [
					{
						type: "directory",
						label: "workspace",
						path: "/tmp/project",
					},
				],
				attachments: [
					{
						id: "attachment-1",
						kind: "file",
						name: "notes.txt",
						path: "/tmp/notes.txt",
						mimeType: "text/plain",
						status: "ready",
					},
				],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
		});

		expect(result.ok).toBe(false);
		if (result.ok) {
			return;
		}
		expect(result.blocks).toEqual([
			"Shell mode is not supported by the selected provider yet.",
			"Shell mode cannot send context yet.",
			"Shell mode cannot send attachments yet.",
		]);
	});
});
