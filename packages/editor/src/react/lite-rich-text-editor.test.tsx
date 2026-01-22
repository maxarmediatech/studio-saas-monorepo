// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiteRichTextEditor } from "./lite-rich-text-editor";

describe("LiteRichTextEditor", () => {
	it("renders without crashing", () => {
		expect(() => {
			render(
				<LiteRichTextEditor
					value={{ type: "doc", content: [] }}
					onChange={() => {}}
					onSubmit={() => {}}
				/>,
			);
		}).not.toThrow();
	});
});
