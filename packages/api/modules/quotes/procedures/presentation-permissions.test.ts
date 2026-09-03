import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (args: {
	context: Record<string, unknown>;
	input: Record<string, unknown>;
}) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	const handlers = new Map<string, Handler>();
	let routeKey = "";
	const chain = {
		route: vi.fn((route: { method: string; path: string }) => {
			routeKey = `${route.method} ${route.path}`;
			return chain;
		}),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler: Handler) => {
			handlers.set(routeKey, handler);
			return chain;
		}),
	};
	return {
		chain,
		handlers,
		requirePermission: vi.fn(),
		list: vi.fn(),
		get: vi.fn(),
		select: vi.fn(),
		start: vi.fn(),
		retry: vi.fn(),
		returnToDraft: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));
vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.requirePermission,
}));
vi.mock("../lib/quotation-presentation-service", () => ({
	listActiveQuotationTemplates: mocks.list,
	getQuotationPresentation: mocks.get,
	selectQuotationTemplate: mocks.select,
}));
vi.mock("../lib/quotation-render-intent-service", () => ({
	startQuotationPdfSend: mocks.start,
	retryQuotationPdfRender: mocks.retry,
	returnQuotationPdfRenderToDraft: mocks.returnToDraft,
}));

const context = { organizationId: "org_1", user: { id: "user_1" } };
const quoteId = "00000000-0000-4000-8000-000000000001";
const intentId = "00000000-0000-4000-8000-000000000002";

function handler(key: string): Handler {
	const value = mocks.handlers.get(key);
	if (!value) {
		throw new Error(`Missing handler for ${key}`);
	}
	return value;
}

describe("quotation presentation procedure permissions", () => {
	beforeAll(async () => {
		await import("./presentation");
	}, 30_000);

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.list.mockReturnValue([]);
		mocks.get.mockResolvedValue({
			documentRevision: 1,
			selectionVersion: null,
			templateId: "classic",
			templateVersion: 1,
			persisted: false,
			renderIntent: null,
		});
		mocks.select.mockResolvedValue({
			documentRevision: 1,
			selectionVersion: 1,
			templateId: "classic",
			templateVersion: 1,
		});
		for (const service of [mocks.start, mocks.retry, mocks.returnToDraft]) {
			service.mockResolvedValue({
				id: intentId,
				quoteId,
				status: "pending",
				documentRevision: 1,
				selectionVersion: 1,
				templateId: "classic",
				templateVersion: 1,
			});
		}
	});

	it.each([
		["GET /quotes/templates", "readOperational"],
		["GET /quotes/{id}/presentation", "readOperational"],
		["PUT /quotes/{id}/presentation", "update"],
		["POST /quotes/{id}/presentation/send", "send"],
		["POST /quotes/{id}/presentation/retry", "send"],
		["POST /quotes/{id}/presentation/return-to-draft", "send"],
	] as const)("gates %s with quote:%s", async (key, action) => {
		await handler(key)({
			context,
			input: {
				id: quoteId,
				renderIntentId: intentId,
				expectedDocumentRevision: 1,
				expectedSelectionVersion: 1,
				templateId: "classic",
				templateVersion: 1,
			},
		});
		expect(mocks.requirePermission).toHaveBeenCalledWith(
			context,
			"quote",
			action,
		);
	});
});
