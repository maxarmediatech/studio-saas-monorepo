import { describe, expect, it } from "vitest";
import { extractText } from "./extract";

describe("extractText", () => {
	it("extracts plain text from paragraphs", () => {
		const text = extractText({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "Hello" }],
				},
				{
					type: "paragraph",
					content: [{ type: "text", text: "World" }],
				},
			],
		});

		expect(text).toBe("Hello\nWorld");
	});
});
