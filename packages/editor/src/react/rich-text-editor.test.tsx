// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichTextEditor } from "./rich-text-editor";

describe("RichTextEditor", () => {
	it("renders without crashing", () => {
		expect(() => {
			render(
				<RichTextEditor
					value={{ type: "doc", content: [] }}
					onChange={() => {}}
				/>,
			);
		}).not.toThrow();
	});
});
