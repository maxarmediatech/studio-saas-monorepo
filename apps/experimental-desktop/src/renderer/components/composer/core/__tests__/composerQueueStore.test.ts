import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../composerPayload";
import type { AdmittedComposerRequest } from "../composerProviderTypes";
import { admitComposerRequest } from "../composerSendController";
import {
	createEmptyComposerQueueState,
	createPendingQueueItem,
	MAX_QUEUED_COMPOSER_INPUT_LENGTH,
	MAX_QUEUED_COMPOSER_REQUESTS,
	validateQueueAdmission,
} from "../composerQueueStore";

describe("composerQueueStore", () => {
	it("accepts queued requests under limits", () => {
		const state = createEmptyComposerQueueState();
		const result = validateQueueAdmission(state, request("queued prompt"));

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.nextStateBytes).toBeGreaterThan(0);
		}
	});

	it("rejects empty, long, and full queue admissions", () => {
		const emptyRequest = request("valid");
		expect(
			validateQueueAdmission(
				createEmptyComposerQueueState(),
				{
					...emptyRequest,
					providerInput: {
						...emptyRequest.providerInput,
						prompt: "",
					},
				},
			),
		).toEqual({ ok: false, reason: "emptyInput" });
		expect(
			validateQueueAdmission(
				createEmptyComposerQueueState(),
				request("x".repeat(MAX_QUEUED_COMPOSER_INPUT_LENGTH + 1)),
			),
		).toEqual({ ok: false, reason: "inputTooLong" });

		const fullState = {
			...createEmptyComposerQueueState(),
			items: Array.from(
				{ length: MAX_QUEUED_COMPOSER_REQUESTS },
				(_, index) =>
					createPendingQueueItem({
						request: request(`queued ${index}`),
						queueItemId: `queue-${index}`,
						position: index,
						createdAt: "2026-06-24T00:00:00.000Z",
					}),
			),
		};
		expect(validateQueueAdmission(fullState, request("overflow"))).toEqual({
			ok: false,
			reason: "queueFull",
		});
	});
});

function request(prompt: string): AdmittedComposerRequest {
	const admitted = admitComposerRequest({
		payload: buildComposerPayload({
			mode: "ask",
			text: prompt,
			contextItems: [],
			attachments: [],
		}),
		model: "gpt-5.4-mini",
		runtimeMode: "read-only",
		createId: () => `admitted:${prompt}`,
	});
	if (!admitted.ok) {
		throw new Error(admitted.reason);
	}
	return admitted.request;
}
