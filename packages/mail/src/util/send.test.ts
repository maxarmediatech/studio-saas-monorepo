import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

describe("sendEmail", () => {
	beforeEach(() => {
		vi.resetModules();
		process.env = { ...originalEnv };
	});

	afterEach(() => {
		process.env = { ...originalEnv };
		vi.restoreAllMocks();
		vi.resetModules();
	});

	it("rethrows provider failures instead of swallowing them", async () => {
		vi.doMock("../provider", () => ({
			send: vi.fn().mockRejectedValue(new Error("boom")),
		}));

		const { sendEmail } = await import("./send");

		await expect(
			sendEmail({
				to: "hello@example.com",
				subject: "Test subject",
				text: "Test body",
			}),
		).rejects.toThrow("boom");
	});
});
