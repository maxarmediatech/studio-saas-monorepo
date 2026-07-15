import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: {
					idempotencyKey: string;
					accountId: string;
					to: string;
					text: string;
					contactName?: string;
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

import "./send-text";

describe("sendText", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.accept.mockResolvedValue({
			messageId: "message_1",
			outboxId: "outbox_1",
			replayed: false,
		});
		mocks.trigger.mockResolvedValue(false);
	});

	it("durably accepts the scoped request before best-effort wake-up", async () => {
		const result = await mocks.handler({
			input: {
				idempotencyKey: "manual-send-text-0001",
				accountId: "account_1",
				to: "919999999999",
				text: "Hello",
				contactName: "Riya",
			},
			context: {
				organizationId: "org_1",
				user: { id: "user_1" },
			},
		});

		expect(mocks.accept).toHaveBeenCalledWith({
			organizationId: "org_1",
			actorId: "user_1",
			idempotencyKey: "manual-send-text-0001",
			payload: {
				kind: "text",
				accountId: "account_1",
				to: "919999999999",
				text: "Hello",
				contactName: "Riya",
			},
		});
		expect(mocks.trigger).toHaveBeenCalledWith({ outboxId: "outbox_1" });
		expect(result).toEqual({
			data: { messageId: "message_1", outboxId: "outbox_1" },
			message: "Message queued",
		});
	});
});
