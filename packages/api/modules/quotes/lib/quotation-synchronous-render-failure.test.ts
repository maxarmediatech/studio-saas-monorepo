import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	process: vi.fn(),
	trackActivity: vi.fn(),
	update: vi.fn(),
}));

vi.mock("@repo/logs", () => ({
	logger: { error: vi.fn() },
}));
vi.mock("./quotation-render-worker", () => ({
	processQuotationPdfRenderIntent: mocks.process,
}));
vi.mock("./quotation-render-existing-intent", () => ({
	findExistingAcceptedQuotationPdfIntent: vi.fn().mockResolvedValue({
		id: "intent_1",
		quoteId: "quote_1",
		status: "pending",
		documentRevision: 7,
		selectionVersion: 3,
		templateId: "classic",
		templateVersion: 2,
	}),
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
vi.mock("./quotation-pdf-service", () => ({
	resolveQuotationBranding: vi.fn(),
}));
vi.mock("./quotation-presentation-service", () => ({
	implicitClassicPresentation: vi.fn(),
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
		status: "draft",
		title: "Failure quotation",
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
		documentRevision: 7,
		selectionVersion: 3,
		templateId: "classic",
		templateVersion: 2,
		taskId: null,
		lastErrorCode: "RENDER_FAILED",
		lastErrorMessage: "Storage unavailable",
	};
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
		update: mocks.update,
	};
	mocks.update.mockImplementation((_table: unknown) => ({
		set: (values: { status?: string }) => ({
			where: () => ({
				returning: vi
					.fn()
					.mockResolvedValue([{ ...intent, ...values }]),
			}),
		}),
	}));
	return {
		and: vi.fn((...values) => values),
		eq: vi.fn((...values) => values),
		isNull: vi.fn((value) => value),
		quotationPdfRenderIntents: intentTable,
		quotationPresentations: presentationTable,
		quotes: quoteTable,
		db: { transaction: vi.fn(async (callback) => callback(tx)) },
	};
});

import { startQuotationPdfSend } from "./quotation-render-intent-service";

describe("synchronous quotation PDF failure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.process.mockRejectedValue(new Error("Storage unavailable"));
	});

	it("keeps the quote draft and retains a resumable render intent", async () => {
		await expect(
			startQuotationPdfSend(
				{
					organizationId: "org_1",
					user: {
						id: "user_1",
						name: "Failure user",
						email: "failure@example.com",
					},
				},
				{
					quoteId: "quote_1",
					expectedDocumentRevision: 7,
					expectedSelectionVersion: 3,
				},
			),
		).rejects.toMatchObject({
			code: "BAD_REQUEST",
			message:
				"Could not generate the quotation PDF. The quotation remains a draft. Try again.",
		});

		expect(mocks.update).toHaveBeenCalledOnce();
		expect(mocks.update).toHaveBeenCalledWith(
			expect.objectContaining({ id: "intent.id" }),
		);
		expect(mocks.trackActivity).not.toHaveBeenCalled();
	});
});
