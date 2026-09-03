import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	trackActivity: vi.fn(),
	transaction: vi.fn(),
	tx: null as unknown,
}));

vi.mock("../../activities/lib", () => ({
	trackActivityWithExecutor: mocks.trackActivity,
}));
vi.mock("../../studio/schemas/quotation-document", () => ({
	strictQuotationDocumentV1Schema: { parse: vi.fn((value) => value) },
}));
vi.mock("../pdf/registry", () => ({
	assertQuotationPdfTemplateCompatibility: vi.fn(),
	quotationPdfTemplateRegistry: {},
}));
vi.mock("../pdf/templates/classic-v0", () => ({
	CLASSIC_V0_QUOTATION_TEMPLATE_ID: "classic",
	CLASSIC_V0_QUOTATION_TEMPLATE_VERSION: 2,
}));
vi.mock("./quotation-pdf-service", () => ({
	resolveQuotationBranding: vi.fn(),
}));
vi.mock("./quotation-presentation-service", () => ({
	implicitClassicPresentation: vi.fn(),
}));
vi.mock("./quotation-render-existing-intent", () => ({
	findExistingAcceptedQuotationPdfIntent: vi.fn(),
}));
vi.mock("./quotation-render-worker", () => ({
	processQuotationPdfRenderIntent: vi.fn(),
}));
vi.mock("@repo/database", () => {
	const quoteTable = {
		id: "quote.id",
		organizationId: "quote.organizationId",
		deletedAt: "quote.deletedAt",
	};
	const presentationTable = { quoteId: "presentation.quoteId" };
	const intentTable = {
		id: "intent.id",
		quoteId: "intent.quoteId",
		organizationId: "intent.organizationId",
	};
	const quote = {
		id: "quote_1",
		organizationId: "org_1",
		status: "preparing",
		title: "Return-to-draft quotation",
		documentRevision: 7,
	};
	const presentation = {
		quoteId: quote.id,
		selectionVersion: 3,
		templateId: "classic",
		templateVersion: 2,
	};
	const intent = {
		id: "intent_1",
		quoteId: quote.id,
		organizationId: quote.organizationId,
		status: "failed",
		documentRevision: quote.documentRevision,
		selectionVersion: presentation.selectionVersion,
		templateId: presentation.templateId,
		templateVersion: presentation.templateVersion,
		taskId: "run_1",
		lastErrorCode: "RENDER_FAILED",
		lastErrorMessage: "Render failed",
	};
	const updated = { ...intent, status: "returned_to_draft" };
	const tx = {
		select: vi.fn(() => ({
			from: (table: unknown) => ({
				where: () => ({
					for: vi
						.fn()
						.mockResolvedValue(
							table === quoteTable
								? [quote]
								: table === presentationTable
									? [presentation]
									: [intent],
						),
				}),
			}),
		})),
		update: vi.fn((table: unknown) => ({
			set: vi.fn(() => ({
				where: vi.fn(() => ({
					returning: vi
						.fn()
						.mockResolvedValue(
							table === intentTable ? [updated] : [],
						),
				})),
			})),
		})),
	};
	mocks.tx = tx;
	mocks.transaction.mockImplementation(async (callback) => callback(tx));
	return {
		and: vi.fn((...values) => values),
		eq: vi.fn((...values) => values),
		isNull: vi.fn((value) => value),
		quotationPdfRenderIntents: intentTable,
		quotationPresentations: presentationTable,
		quotes: quoteTable,
		db: { transaction: mocks.transaction },
	};
});

import { returnQuotationPdfRenderToDraft } from "./quotation-render-intent-service";

describe("return quotation PDF render to draft", () => {
	it("records the preparing-to-draft activity in the status transaction", async () => {
		mocks.trackActivity.mockResolvedValue(undefined);

		await expect(
			returnQuotationPdfRenderToDraft(
				{
					organizationId: "org_1",
					user: {
						id: "user_1",
						name: "Return user",
						email: "return@example.com",
					},
				},
				{
					quoteId: "quote_1",
					renderIntentId: "intent_1",
					expectedDocumentRevision: 7,
					expectedSelectionVersion: 3,
				},
			),
		).resolves.toMatchObject({ status: "returned_to_draft" });

		expect(mocks.transaction).toHaveBeenCalledOnce();
		expect(mocks.trackActivity).toHaveBeenCalledWith(
			mocks.tx,
			{
				organizationId: "org_1",
				user: expect.objectContaining({ id: "user_1" }),
			},
			{
				entityType: "quote",
				entityId: "quote_1",
				entityName: "Return-to-draft quotation",
				action: "status_changed",
				field: "status",
				oldValue: "preparing",
				newValue: "draft",
				metadata: {
					renderIntentId: "intent_1",
					templateId: "classic",
					templateVersion: 2,
					documentRevision: 7,
					selectionVersion: 3,
				},
			},
		);
	});
});
