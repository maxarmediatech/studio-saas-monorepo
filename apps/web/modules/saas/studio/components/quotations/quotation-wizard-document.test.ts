import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	buildQuotationTitle,
	createDefaultQuotationDraft,
	createDraftId,
	createLeadFromQuotationClient,
	updateQuotationClientField,
} from "./quotation-wizard-data";
import { quotationDraftToDocument } from "./quotation-wizard-document";

beforeAll(() => {
	vi.stubGlobal("crypto", { randomUUID });
});

describe("quotation wizard document", () => {
	it("starts with a genuinely empty tentative common event", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		expect(draft.events[0]).toMatchObject({
			side: "common",
			tentative: true,
			date: "",
			guestCount: "",
		});
		expect(quotationDraftToDocument(draft).events[0]).toMatchObject({
			timelineMode: "tentative",
			dateWindow: null,
			guestCount: null,
		});
	});

	it("uses collision-resistant IDs and preserves term row keys", () => {
		expect(createDraftId("event")).toMatch(
			/^event-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		const draft = createDefaultQuotationDraft("2026-08-03");
		draft.timelines = ["Eight weeks"];
		draft.timelineKeys = ["timeline-stable"];
		draft.terms = ["Cancellation clause"];
		draft.termKeys = ["term-stable"];
		const first = quotationDraftToDocument(draft);
		const second = quotationDraftToDocument(draft);
		expect(second.deliveryTimelines).toEqual(first.deliveryTimelines);
		expect(second.fixedTerms).toEqual(first.fixedTerms);
		expect(first.deliveryTimelines[0]?.key).toBe("timeline-stable");
		expect(first.fixedTerms[0]?.key).toBe("term-stable");
	});

	it("uses shared title wording and clears identity only for Create lead", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		draft.quotationType = "Wedding";
		const firstClient = draft.clients[0];
		if (!firstClient) {
			throw new Error("Default client is missing");
		}
		firstClient.name = "A";
		draft.clients.push({ ...firstClient, id: "client-b", name: "B" });
		expect(buildQuotationTitle(draft)).toBe("A and B - Wedding quotation");
		const selected = {
			...firstClient,
			clientId: "existing-client",
			clientUpdatedAt: "2026-08-03T00:00:00.000Z",
			persistAsLead: false,
		};
		expect(
			updateQuotationClientField(selected, "name", "Nickname"),
		).toMatchObject({
			name: "Nickname",
			clientId: "existing-client",
		});
		expect(
			createLeadFromQuotationClient(selected, "New lead"),
		).toMatchObject({
			name: "New lead",
			clientId: null,
			clientUpdatedAt: null,
			persistAsLead: true,
		});
	});

	it("preserves unresolved contact fields without requesting CRM creation", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		const client = draft.clients[0];
		if (!client) {
			throw new Error("Default client is missing");
		}
		client.name = "Client one";
		client.email = "client@example.com";

		expect(quotationDraftToDocument(draft).participants[0]).toMatchObject({
			resolutionIntent: "none",
			contact: {
				name: "Client one",
				email: "client@example.com",
			},
		});
		draft.clients[0] = createLeadFromQuotationClient(client, client.name);
		expect(quotationDraftToDocument(draft).participants[0]).toMatchObject({
			resolutionIntent: "create_lead",
			contact: {
				name: "Client one",
				email: "client@example.com",
			},
		});
	});
});
