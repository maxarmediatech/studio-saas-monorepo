import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	order: [] as string[],
	scenario: {
		existingIntent: false,
		implicitClassic: false,
		quoteStatus: "draft",
	},
	resolveBranding: vi.fn(),
	process: vi.fn(),
	trackActivity: vi.fn(),
	transaction: vi.fn(),
	insertValues: vi.fn(),
}));

vi.mock("./quotation-pdf-service", () => ({
	resolveQuotationBranding: mocks.resolveBranding,
}));
vi.mock("./quotation-render-worker", () => ({
	processQuotationPdfRenderIntent: mocks.process,
}));
vi.mock("../../activities/lib", () => ({
	trackActivityWithExecutor: mocks.trackActivity,
}));
vi.mock("../../studio/schemas/quotation-document", () => ({
	QUOTATION_PDF_RENDERER_VERSION: "quotation-pdf-v1",
	strictQuotationDocumentV1Schema: {
		parse: vi.fn((value) => value),
	},
}));
vi.mock("../pdf/registry", () => ({
	assertQuotationPdfTemplateCompatibility: vi.fn(),
	quotationPdfTemplateRegistry: {
		getActive: vi.fn(() => ({
			manifest: {
				id: "classic",
				version: 2,
				composerVersion: 1,
				rendererVersion: "quotation-pdf-v1",
			},
			copyProfile: { version: 1 },
		})),
	},
}));
vi.mock("@repo/database", () => {
	const quote = () => ({
		id: "quote_1",
		organizationId: "org_1",
		quoteNumber: "Q-001",
		version: 1,
		status: mocks.scenario.quoteStatus,
		title: "Boundary quotation",
		documentVersion: 1,
		document: { schemaVersion: 1, title: "Boundary quotation" },
		documentRevision: 7,
		expiresAt: null,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
	});
	const presentation = () => ({
		quoteId: "quote_1",
		templateId: "classic",
		templateVersion: mocks.scenario.implicitClassic ? 1 : 2,
		selectionVersion: mocks.scenario.implicitClassic ? 1 : 3,
	});
	const intent = () => ({
		id: "intent_1",
		organizationId: "org_1",
		quoteId: "quote_1",
		status: "pending",
		documentRevision: 7,
		selectionVersion: presentation().selectionVersion,
		templateId: presentation().templateId,
		templateVersion: presentation().templateVersion,
	});
	const tx = {
		select: vi.fn(),
		insert: vi.fn(() => ({
			values: (values: unknown) => {
				mocks.insertValues(values);
				return { returning: vi.fn().mockResolvedValue([intent()]) };
			},
		})),
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
		})),
	};
	mocks.transaction.mockImplementation(async (callback) => {
		mocks.order.push("transaction");
		let selection = 0;
		tx.select.mockImplementation(() => ({
			from: () => ({
				where: () => ({
					for: vi.fn().mockImplementation(async () => {
						selection += 1;
						if (selection === 1) {
							return [quote()];
						}
						if (selection === 2) {
							return [presentation()];
						}
						return mocks.scenario.existingIntent ? [intent()] : [];
					}),
				}),
			}),
		}));
		return callback(tx);
	});
	return {
		and: vi.fn((...values) => values),
		eq: vi.fn((...values) => values),
		inArray: vi.fn((...values) => values),
		isNull: vi.fn((value) => value),
		lt: vi.fn((...values) => values),
		quotationPdfRenderIntents: {
			id: "intent.id",
			organizationId: "intent.organizationId",
			quoteId: "intent.quoteId",
			idempotencyKey: "intent.idempotencyKey",
		},
		quotationPresentations: { quoteId: "presentation.quoteId" },
		quotes: {
			id: "quote.id",
			organizationId: "quote.organizationId",
			deletedAt: "quote.deletedAt",
		},
		db: { transaction: mocks.transaction },
	};
});

import { startQuotationPdfSend } from "./quotation-render-intent-service";

const branding = {
	schemaVersion: 1 as const,
	organizationName: "Boundary Studio",
	address: null,
	email: null,
	phone: null,
	taxIdentifier: null,
	timezone: "UTC",
	logoStorageKey: null,
	logoMimeType: null,
	logoSha256: null,
};

describe("quotation render-intent transaction boundary", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.order.length = 0;
		mocks.scenario.existingIntent = false;
		mocks.scenario.implicitClassic = false;
		mocks.scenario.quoteStatus = "draft";
		mocks.resolveBranding.mockImplementation(async () => {
			mocks.order.push("branding");
			return { branding, logoDataUri: "data:image/png;base64,logo" };
		});
		mocks.process.mockImplementation(async () => {
			mocks.order.push("render");
			return { id: "intent_1", status: "completed" };
		});
		mocks.trackActivity.mockResolvedValue(undefined);
	});

	it("keeps remote branding between the existing-intent check and authoritative insert transaction", async () => {
		await expect(
			startQuotationPdfSend(
				{
					organizationId: "org_1",
					user: {
						id: "user_1",
						name: "Boundary user",
						email: "boundary@example.com",
					},
				},
				{
					quoteId: "quote_1",
					expectedDocumentRevision: 7,
					expectedSelectionVersion: 3,
				},
			),
		).resolves.toMatchObject({
			id: "intent_1",
			documentRevision: 7,
			selectionVersion: 3,
		});

		expect(mocks.order).toEqual([
			"transaction",
			"branding",
			"transaction",
			"render",
		]);
		expect(mocks.insertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				documentRevision: 7,
				selectionVersion: 3,
				brandingSnapshot: branding,
				idempotencyKey: "quote_1:7:3",
				sourceDocument: expect.objectContaining({
					logoDataUri: "data:image/png;base64,logo",
					quoteNumber: "Q-001",
					quoteVersion: 1,
				}),
			}),
		);
	});

	it("returns an existing historical implicit-template intent before branding resolution", async () => {
		mocks.scenario.existingIntent = true;
		mocks.scenario.implicitClassic = true;
		mocks.scenario.quoteStatus = "preparing";
		mocks.resolveBranding.mockRejectedValue(new Error("S3 unavailable"));

		await expect(
			startQuotationPdfSend(
				{
					organizationId: "org_1",
					user: {
						id: "user_1",
						name: "Boundary user",
						email: "boundary@example.com",
					},
				},
				{
					quoteId: "quote_1",
					expectedDocumentRevision: 7,
					expectedSelectionVersion: null,
				},
			),
		).resolves.toMatchObject({
			id: "intent_1",
			documentRevision: 7,
			selectionVersion: 1,
			templateId: "classic",
			templateVersion: 1,
		});

		expect(mocks.order).toEqual(["transaction", "render"]);
		expect(mocks.resolveBranding).not.toHaveBeenCalled();
		expect(mocks.insertValues).not.toHaveBeenCalled();
		expect(mocks.process).toHaveBeenCalledWith("intent_1");
	});
});
