import { describe, expect, it } from "vitest";
import { getPreferredScrollBehavior } from "./motion";

describe("getPreferredScrollBehavior", () => {
	it("disables scripted smooth scrolling when reduced motion is requested", () => {
		expect(getPreferredScrollBehavior(true)).toBe("auto");
	});

	it("keeps smooth scrolling for users without a reduced-motion preference", () => {
		expect(getPreferredScrollBehavior(false)).toBe("smooth");
	});
});
