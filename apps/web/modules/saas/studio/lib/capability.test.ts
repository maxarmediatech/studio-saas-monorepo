import { describe, expect, it } from "vitest";
import { getCapabilities } from "./capability.server";

describe("quotation list capabilities", () => {
	it("allows a custom quote-list role without granting client-list", () => {
		const caps = getCapabilities("quote_auditor", {
			quote: ["list"],
		});
		expect(caps.quoteCreate).toBe(false);
		expect(caps.clientList).toBe(false);
	});

	it("keeps manager client filtering after the default-role backfill", () => {
		const caps = getCapabilities("manager", {
			quote: ["update", "list", "send", "revise"],
			client: ["read", "list"],
		});
		expect(caps.clientList).toBe(true);
	});
});
