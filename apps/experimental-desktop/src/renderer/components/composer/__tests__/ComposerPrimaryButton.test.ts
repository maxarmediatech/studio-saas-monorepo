import { describe, expect, it } from "vitest";
import { resolvePrimaryAction } from "../composerPrimaryAction";

describe("resolvePrimaryAction", () => {
	it("keeps stop reachable while a running turn also has queueable text", () => {
		expect(
			resolvePrimaryAction({
				mode: "ask",
				disabled: false,
				turnActive: true,
				queueActive: true,
				hasText: true,
				blocked: false,
			}),
		).toBe("stop");
	});

	it("queues text only when no turn is actively stoppable", () => {
		expect(
			resolvePrimaryAction({
				mode: "ask",
				disabled: false,
				turnActive: false,
				queueActive: true,
				hasText: true,
				blocked: false,
			}),
		).toBe("queue");
	});
});
