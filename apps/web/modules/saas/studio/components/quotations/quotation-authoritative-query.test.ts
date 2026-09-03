import { describe, expect, it } from "vitest";
import {
	authoritativeQuotationQuery,
	isQuotationPresentationRevisionCurrent,
	quotationPresentationRevisionToRefetch,
} from "./quotation-authoritative-query";

describe("authoritative quotation query", () => {
	it("overrides a shared fresh-cache window before send", () => {
		const options = authoritativeQuotationQuery({
			queryKey: ["quotes", "presentation", "quote-1"],
			staleTime: 60_000,
		});
		expect(options).toEqual({
			queryKey: ["quotes", "presentation", "quote-1"],
			staleTime: 0,
		});
	});

	it("requests one authoritative refresh when the expected revision advances", () => {
		expect(quotationPresentationRevisionToRefetch(4, 5, null)).toBe(5);
		expect(quotationPresentationRevisionToRefetch(4, 5, 5)).toBeNull();
		expect(isQuotationPresentationRevisionCurrent(4, 5)).toBe(false);

		expect(isQuotationPresentationRevisionCurrent(5, 5)).toBe(true);
		expect(quotationPresentationRevisionToRefetch(5, 5, 5)).toBeNull();

		expect(quotationPresentationRevisionToRefetch(5, 6, null)).toBe(6);
	});
});
