import { describe, expect, it } from "vitest";
import { readDeltaText } from "../controller-utils";

describe("readDeltaText", () => {
	it("reads legacy string deltas", () => {
		expect(readDeltaText({ delta: "hello" })).toBe("hello");
	});

	it("reads nested object deltas", () => {
		expect(
			readDeltaText({
				delta: { text: "nested" },
			}),
		).toBe("nested");
	});

	it("joins content array text deltas", () => {
		expect(
			readDeltaText({
				delta: {
					content: [
						{ type: "output_text", text: "hel" },
						{ type: "output_text", text: "lo" },
					],
				},
			}),
		).toBe("hello");
	});

	it("reads item/message text fallback shapes", () => {
		expect(
			readDeltaText({
				item: { content: [{ text: "from item" }] },
			}),
		).toBe("from item");
		expect(
			readDeltaText({
				message: { parts: [{ text: "from " }, { text: "parts" }] },
			}),
		).toBe("from parts");
	});

	it("returns undefined for non-text deltas", () => {
		expect(readDeltaText({ delta: { annotations: [] } })).toBeUndefined();
	});
});
