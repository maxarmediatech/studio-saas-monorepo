import { describe, expect, it } from "vitest";
import { coerceContentJsonFromText } from "./coerce";

describe("coerceContentJsonFromText", () => {
	it("wraps plain text into a doc/paragraph", () => {
		const json = coerceContentJsonFromText("Hello");
		expect(json.type).toBe("doc");
		expect(json.content?.[0]?.type).toBe("paragraph");
	});

	it("splits newlines into paragraphs", () => {
		const json = coerceContentJsonFromText("Hello\nWorld");
		const paragraphs = json.content ?? [];
		expect(paragraphs.length).toBe(2);
	});
});
