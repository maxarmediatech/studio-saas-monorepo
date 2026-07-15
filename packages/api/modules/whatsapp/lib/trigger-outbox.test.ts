import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	trigger: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("@trigger.dev/sdk/v3", () => ({
	tasks: { trigger: mocks.trigger },
}));
vi.mock("@repo/logs", () => ({
	logger: { warn: mocks.warn },
}));

import { triggerWhatsAppOutbox } from "./trigger-outbox";

describe("triggerWhatsAppOutbox", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns success after waking the worker", async () => {
		mocks.trigger.mockResolvedValue({ id: "run_1" });

		await expect(
			triggerWhatsAppOutbox({ outboxId: "outbox_1" }),
		).resolves.toBe(true);
		expect(mocks.trigger).toHaveBeenCalledWith("whatsapp-process-outbox", {
			outboxId: "outbox_1",
		});
	});

	it("logs and preserves durable acceptance when wake-up fails", async () => {
		const error = new Error("Trigger unavailable");
		mocks.trigger.mockRejectedValue(error);

		await expect(
			triggerWhatsAppOutbox({ outboxId: "outbox_1" }),
		).resolves.toBe(false);
		expect(mocks.warn).toHaveBeenCalledWith(
			"Failed to trigger WhatsApp outbox task",
			{ outboxId: "outbox_1", error },
		);
	});
});
