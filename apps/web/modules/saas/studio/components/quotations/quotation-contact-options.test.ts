import { describe, expect, it } from "vitest";
import {
	canOfferCreateLead,
	getQuotationContactEnterAction,
} from "./quotation-contact-options";

describe("quotation contact choices", () => {
	it("does not offer Create lead for an exact existing contact", () => {
		expect(
			canOfferCreateLead(" Client One ", ["Client one"], false, true),
		).toBe(false);
	});

	it("maps Enter on the create option to explicit lead creation", () => {
		expect(getQuotationContactEnterAction(2, 2, true)).toBe("create");
	});
});
