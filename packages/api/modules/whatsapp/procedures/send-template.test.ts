import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: {
					idempotencyKey: string;
					accountId: string;
					to: string;
					templateName: string;
					language: string;
				};
				context: {
					organizationId: string;
					user: { id: string };
				};
		  }) => Promise<unknown>)
		| undefined;
	const procedureChain = {
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		output: vi.fn(() => procedureChain),
		handler: vi.fn((handler) => {
			capturedHandler = handler;
			return procedureChain;
		}),
	};

	return {
		accept: vi.fn(),
		get handler() {
			if (!capturedHandler) {
				throw new Error("Handler not captured");
			}
			return capturedHandler;
		},
		procedureChain,
		trigger: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.procedureChain,
}));
vi.mock("../lib/manual-send-service", () => ({
	acceptManualWhatsAppSend: mocks.accept,
}));
vi.mock("../lib/trigger-outbox", () => ({
	triggerWhatsAppOutbox: mocks.trigger,
}));

import "./send-template";

describe("sendTemplate", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.accept.mockResolvedValue({
			messageId: "message_1",
			outboxId: "outbox_1",
			replayed: true,
		});
		mocks.trigger.mockResolvedValue(true);
	});

	it("routes template persistence through the transactional service", async () => {
		const result = await mocks.handler({
			input: {
				idempotencyKey: "manual-send-template-0001",
				accountId: "account_1",
				to: "919999999999",
				templateName: "booking_confirmation",
				language: "en_US",
			},
			context: {
				organizationId: "org_1",
				user: { id: "user_1" },
			},
		});

		expect(mocks.accept).toHaveBeenCalledWith({
			organizationId: "org_1",
			actorId: "user_1",
			idempotencyKey: "manual-send-template-0001",
			payload: {
				kind: "template",
				accountId: "account_1",
				to: "919999999999",
				templateName: "booking_confirmation",
				language: "en_US",
				components: undefined,
			},
		});
		expect(result).toEqual({
			data: { messageId: "message_1", outboxId: "outbox_1" },
			message: "Message queued",
		});
	});
});
