// @vitest-environment jsdom

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReadOnlyRenderer } from "./read-only-renderer";

describe("ReadOnlyRenderer", () => {
	it("renders without crashing", () => {
		expect(() => {
			render(<ReadOnlyRenderer content={{ type: "doc", content: [] }} />);
		}).not.toThrow();
	});
});
