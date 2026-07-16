import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: {
					idempotencyKey: string;
					accountId: string;
					to: string;
					mediaType: "image";
					mediaKey: string;
					mimeType: string;
					caption?: string;
					fileName?: string;
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

import "./send-media";

describe("sendMedia", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.accept.mockResolvedValue({
			messageId: "message_1",
			outboxId: "outbox_1",
			replayed: false,
		});
		mocks.trigger.mockResolvedValue(true);
	});

	it("routes media persistence through the transactional service", async () => {
		const result = await mocks.handler({
			input: {
				idempotencyKey: "manual-send-media-0001",
				accountId: "account_1",
				to: "919999999999",
				mediaType: "image",
				mediaKey: "orgs/org_1/whatsapp-media/photo.jpg",
				mimeType: "image/jpeg",
				caption: "Portfolio",
				fileName: "photo.jpg",
			},
			context: {
				organizationId: "org_1",
				user: { id: "user_1" },
			},
		});

		expect(mocks.accept).toHaveBeenCalledWith({
			organizationId: "org_1",
			actorId: "user_1",
			idempotencyKey: "manual-send-media-0001",
			payload: {
				kind: "media",
				accountId: "account_1",
				to: "919999999999",
				mediaType: "image",
				mediaUrl: undefined,
				mediaKey: "orgs/org_1/whatsapp-media/photo.jpg",
				mimeType: "image/jpeg",
				caption: "Portfolio",
				fileName: "photo.jpg",
			},
		});
		expect(result).toEqual({
			data: { messageId: "message_1", outboxId: "outbox_1" },
			message: "Message queued",
		});
	});
});
