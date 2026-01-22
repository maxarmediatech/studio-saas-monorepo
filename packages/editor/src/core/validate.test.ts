import { describe, expect, it } from "vitest";
import { validateContentJson } from "./validate";

describe("validateContentJson", () => {
	it("accepts a minimal paragraph doc", () => {
		const result = validateContentJson({
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [{ type: "text", text: "Hello" }],
					},
				],
			},
		});

		expect(result.ok).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("rejects unknown node types", () => {
		const result = validateContentJson({
			content: {
				type: "doc",
				content: [{ type: "unknown_node", content: [] }],
			},
		});

		expect(result.ok).toBe(false);
		expect(result.errors[0]?.message).toMatch(/unknown node/i);
	});

	it("rejects javascript: links", () => {
		const result = validateContentJson({
			content: {
				type: "doc",
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: "Click",
								marks: [
									{
										type: "link",
										attrs: { href: "javascript:alert(1)" },
									},
								],
							},
						],
					},
				],
			},
		});

		expect(result.ok).toBe(false);
		expect(result.errors.some((err) => /unsafe link/i.test(err.message))).toBe(
			true,
		);
	});
});
