import { randomUUID } from "node:crypto";
import type { QuoteDetail } from "@repo/api/modules/studio/schemas/quote";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
	buildQuotationTitle,
	createDefaultQuotationDraft,
	createDraftId,
	createLeadFromQuotationClient,
	updateQuotationClientField,
} from "./quotation-wizard-data";
import {
	quotationDetailToWizardDraft,
	quotationDocumentToWizardDraft,
	quotationDraftToDocument,
} from "./quotation-wizard-document";

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

	it("can use a stable render seed for hydration-safe initial field IDs", () => {
		const server = createDefaultQuotationDraft("2026-08-03", ":R1:");
		const client = createDefaultQuotationDraft("2026-08-03", ":R1:");

		expect(client.clients[0]?.id).toBe(server.clients[0]?.id);
		expect(client.events[0]?.id).toBe(server.events[0]?.id);
		expect(client.packages[0]?.id).toBe(server.packages[0]?.id);
		expect(client.clients[0]?.id).toBe("client-R1");
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

	it("retains applied terms provenance through document reload", () => {
		const draft = createDefaultQuotationDraft("2026-08-03");
		draft.termsConfiguration = {
			id: "terms-id",
			key: "wedding_terms",
			label: "Wedding terms",
			metadataVersion: 1,
		};
		const document = quotationDraftToDocument(draft);
		const reloaded = quotationDetailToWizardDraft({
			document,
			documentVersion: 1,
			status: "draft",
			expiresAt: "2026-08-17",
		} as QuoteDetail);
		expect(reloaded?.termsConfiguration).toEqual(draft.termsConfiguration);
	});

	it("hydrates a reused server draft instead of overwriting it with a new tab", () => {
		const persisted = createDefaultQuotationDraft("2026-08-03");
		persisted.title = "Persisted working draft";
		const participant = persisted.clients[0];
		if (!participant) {
			throw new Error("Default client is missing");
		}
		persisted.clients[0] = {
			...participant,
			name: "Existing client",
		};

		const resumed = quotationDocumentToWizardDraft(
			quotationDraftToDocument(persisted),
		);

		expect(resumed.title).toBe("Persisted working draft");
		expect(resumed.clients[0]?.name).toBe("Existing client");
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
