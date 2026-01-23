import { describe, expect, it } from "vitest";
import { renderJsonToHtml, renderJsonToText } from "./render";

describe("render", () => {
	it("renders JSON to plain text", () => {
		const text = renderJsonToText({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "Hello" }],
				},
			],
		});

		expect(text).toBe("Hello");
	});

	it("renders JSON to HTML", () => {
		const html = renderJsonToHtml({
			type: "doc",
			content: [
				{
					type: "paragraph",
					content: [{ type: "text", text: "Hello" }],
				},
			],
		});

		expect(html).toContain("<p");
		expect(html).not.toContain("<script");
		expect(html).toContain("Hello");
		expect(html).toContain("</p>");
	});
});
