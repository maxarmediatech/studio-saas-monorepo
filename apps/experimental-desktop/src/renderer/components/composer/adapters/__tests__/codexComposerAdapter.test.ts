import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../composerPayload";
import { buildCodexProviderSendInput } from "../codexComposerAdapter";

describe("buildCodexProviderSendInput", () => {
	it("maps ready image attachments to Codex native image input", () => {
		const result = buildCodexProviderSendInput({
			payload: buildComposerPayload({
				mode: "ask",
				text: "Describe this",
				contextItems: [],
				attachments: [
					{
						id: "image-1",
						kind: "image",
						name: "shot.png",
						path: "/tmp/shot.png",
						mimeType: "image/png",
						status: "ready",
					},
				],
			}),
			model: "gpt-5.4-mini",
			runtimeMode: "read-only",
		});

		expect(result.provider).toBe("codex");
		expect(result.nativeInput).toEqual([
			{ type: "text", text: "User request:\nDescribe this" },
			{
				type: "local_image",
				path: "/tmp/shot.png",
				name: "shot.png",
				mimeType: "image/png",
			},
		]);
		expect(result.legacyPayload.nativeInput).toEqual({
			kind: "codex-app-server-v1",
			imageCount: 1,
			fileCount: 0,
		});
	});
});
