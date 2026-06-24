import { describe, expect, it } from "vitest";
import {
	validateAdmittedComposerRequest,
	validateAdmittedSendBody,
	validateQueueUpdateBody,
} from "../admitted-request";

describe("admitted request validation", () => {
	it("accepts Codex admitted requests and preserves route promotion fields", () => {
		const body = validateAdmittedSendBody({
			draftId: "draft-1",
			cwd: "/workspace",
			request: admittedRequest({ id: "admitted-1", prompt: "Ship it" }),
		});

		expect(body.draftId).toBe("draft-1");
		expect(body.cwd).toBe("/workspace");
		expect(body.request.id).toBe("admitted-1");
		expect(body.request.providerInput.prompt).toBe("Ship it");
		expect(body.request.requestParts).toEqual([
			{ type: "text", text: "Ship it" },
		]);
	});

	it("rejects provider envelopes with unadmitted native paths", () => {
		expect(() =>
			validateAdmittedComposerRequest(
				admittedRequest({
					id: "admitted-bad",
					prompt: "Use file",
					nativeInput: [
						{
							type: "local_file",
							path: "/tmp/injected.txt",
							name: "injected.txt",
							mimeType: "text/plain",
						},
					],
				}),
			),
		).toThrow("unadmitted file path");
	});

	it("allows provider native files only when matched by admitted request parts", () => {
		const request = validateAdmittedComposerRequest(
			admittedRequest({
				id: "admitted-file",
				prompt: "Use file",
				requestParts: [
					{ type: "text", text: "Use file" },
					{
						type: "file_ref",
						path: "/tmp/source.txt",
						name: "source.txt",
						mimeType: "text/plain",
					},
				],
				nativeInput: [
					{
						type: "local_file",
						path: "/tmp/source.txt",
						name: "source.txt",
						mimeType: "text/plain",
					},
				],
			}),
		);

		expect(request.providerInput.nativeInput).toEqual([
			{
				type: "local_file",
				path: "/tmp/source.txt",
				name: "source.txt",
				mimeType: "text/plain",
			},
		]);
	});

	it("rejects native files whose display name differs from the admitted part", () => {
		expect(() =>
			validateAdmittedComposerRequest(
				admittedRequest({
					id: "admitted-name-mismatch",
					prompt: "Use file",
					requestParts: [
						{ type: "text", text: "Use file" },
						{
							type: "file_ref",
							path: "/tmp/source.txt",
							name: "source.txt",
							mimeType: "text/plain",
						},
					],
					nativeInput: [
						{
							type: "local_file",
							path: "/tmp/source.txt",
							name: "renamed.txt",
							mimeType: "text/plain",
						},
					],
				}),
			),
		).toThrow("name does not match");
	});

	it("rejects native files whose MIME type differs from the admitted part", () => {
		expect(() =>
			validateAdmittedComposerRequest(
				admittedRequest({
					id: "admitted-mime-mismatch",
					prompt: "Use file",
					requestParts: [
						{ type: "text", text: "Use file" },
						{
							type: "file_ref",
							path: "/tmp/source.txt",
							name: "source.txt",
							mimeType: "text/plain",
						},
					],
					nativeInput: [
						{
							type: "local_file",
							path: "/tmp/source.txt",
							name: "source.txt",
							mimeType: "application/json",
						},
					],
				}),
			),
		).toThrow("MIME type does not match");
	});

	it("validates explicit queue status updates", () => {
		expect(validateQueueUpdateBody({ status: "canceled" })).toEqual({
			status: "canceled",
		});
		expect(() => validateQueueUpdateBody({ status: "paused" })).toThrow(
			"Unsupported queue status",
		);
	});
});

function admittedRequest(input: {
	id: string;
	prompt: string;
	requestParts?: unknown[];
	nativeInput?: unknown[];
}) {
	return {
		id: input.id,
		draftSnapshot: {
			text: input.prompt,
			mode: "ask",
			contextItems: [],
			attachments: [],
			updatedAt: 0,
		},
		requestParts: input.requestParts ?? [
			{ type: "text", text: input.prompt },
		],
		providerInput: {
			provider: "codex",
			prompt: input.prompt,
			nativeInput: input.nativeInput ?? [],
			runtimeMode: "read-only",
			model: "gpt-5.4-mini",
			legacyPayload: {
				text: input.prompt,
				parts: [{ type: "text", text: input.prompt }],
			},
		},
		admission: {
			mode: "ask",
			effectiveRuntime: { provider: "codex", mode: "read-only" },
			capabilityWarnings: [],
			warnings: [],
		},
		compatibilityPayload: {
			text: input.prompt,
			mode: "ask",
			contextItems: [],
			attachments: [],
			parts: [{ type: "text", text: input.prompt }],
			metrics: { textLength: input.prompt.length, attachmentCount: 0 },
		},
	};
}
