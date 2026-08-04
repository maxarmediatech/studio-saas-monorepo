import { describe, expect, it } from "vitest";
import { partitionQuotationContacts } from "./quotation-contact-search";

describe("quotation contact search", () => {
	it("keeps lead rows selectable alongside client rows", () => {
		const lead = { id: "lead-1", lifecycleStage: "lead" as const };
		const client = { id: "client-1", lifecycleStage: "client" as const };

		expect(partitionQuotationContacts([lead, client])).toEqual({
			leads: [lead],
			clients: [client],
		});
	});
});
