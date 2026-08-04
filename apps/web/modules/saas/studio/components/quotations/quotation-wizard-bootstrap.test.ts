import { describe, expect, it } from "vitest";
import { quotationBootstrapQueriesReady } from "./quotation-wizard-bootstrap";

describe("quotation bootstrap query readiness", () => {
	it("continues with booking and package defaults when terms fail", () => {
		expect(
			quotationBootstrapQueriesReady({
				bookingTypesReady: true,
				packageTypesReady: true,
				termsReady: false,
				termsError: true,
			}),
		).toBe(true);
	});

	it("waits while the terms request is still pending", () => {
		expect(
			quotationBootstrapQueriesReady({
				bookingTypesReady: true,
				packageTypesReady: true,
				termsReady: false,
				termsError: false,
			}),
		).toBe(false);
	});
});
