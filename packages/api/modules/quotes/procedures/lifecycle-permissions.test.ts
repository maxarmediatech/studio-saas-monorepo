import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (args: {
	context: Record<string, unknown>;
	input: Record<string, string>;
}) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	const handlers = new Map<string, Handler>();
	let routePath = "";
	const chain = {
		route: vi.fn((route: { path: string }) => {
			routePath = route.path;
			return chain;
		}),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler: Handler) => {
			handlers.set(routePath, handler);
			return chain;
		}),
	};
	return {
		chain,
		handlers,
		requirePermission: vi.fn(),
		send: vi.fn(),
		revise: vi.fn(),
		accept: vi.fn(),
		decline: vi.fn(),
		expire: vi.fn(),
		convert: vi.fn(),
		get: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));
vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.requirePermission,
}));
vi.mock("../lib/quote-acceptance", () => ({ acceptQuote: mocks.accept }));
vi.mock("../lib/quote-conversion", () => ({
	convertAcceptedQuote: mocks.convert,
}));
vi.mock("../lib/quote-query", () => ({ getOrganizationQuote: mocks.get }));
vi.mock("../lib/quote-service", () => ({
	sendQuote: mocks.send,
	reviseQuote: mocks.revise,
	declineQuote: mocks.decline,
	expireQuote: mocks.expire,
}));

const context = { organizationId: "org_1", user: { id: "user_1" } };
const quoteId = "00000000-0000-4000-8000-000000000001";
const optionId = "00000000-0000-4000-8000-000000000002";

function handler(path: string): Handler {
	const result = mocks.handlers.get(path);
	if (!result) {
		throw new Error(`Missing handler for ${path}`);
	}
	return result;
}

describe("quote lifecycle procedure permissions", () => {
	beforeAll(async () => {
		await import("./lifecycle");
		await import("./get");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		for (const service of [
			mocks.send,
			mocks.accept,
			mocks.decline,
			mocks.expire,
		]) {
			service.mockResolvedValue({ id: quoteId });
		}
		mocks.revise.mockResolvedValue({
			id: quoteId,
			quoteNumber: "SO-Q-2608-0001",
			version: 2,
		});
		mocks.get.mockResolvedValue({ id: quoteId });
		mocks.convert.mockResolvedValue({
			id: quoteId,
			referenceNumber: "SO-2608-0001",
			status: "new",
			deletedAt: null,
		});
	});

	it("reserves operational quote detail for readOperational authority", async () => {
		await handler("/quotes/{id}")({ context, input: { id: quoteId } });
		expect(mocks.requirePermission).toHaveBeenCalledWith(
			context,
			"quote",
			"readOperational",
		);
		expect(mocks.get).toHaveBeenCalledWith("org_1", quoteId);
	});

	it.each([
		["/quotes/{id}/send", "send", mocks.send],
		["/quotes/{id}/revise", "revise", mocks.revise],
		["/quotes/{id}/accept", "accept", mocks.accept],
		["/quotes/{id}/decline", "decline", mocks.decline],
		["/quotes/{id}/expire", "expire", mocks.expire],
	] as const)("gates %s with quote:%s", async (path, action, service) => {
		await handler(path)({
			context,
			input: { id: quoteId, quoteOptionId: optionId },
		});
		expect(mocks.requirePermission).toHaveBeenCalledWith(
			context,
			"quote",
			action,
		);
		expect(service).toHaveBeenCalled();
	});

	it("requires quote, booking, and payment authority before conversion", async () => {
		await handler("/quotes/{id}/convert")({
			context,
			input: { id: quoteId },
		});
		expect(mocks.requirePermission.mock.calls).toEqual([
			[context, "quote", "convert"],
			[context, "booking", "create"],
			[context, "payment", "create"],
		]);
		expect(mocks.convert).toHaveBeenCalledOnce();
	});

	it("does not convert when payment creation is denied", async () => {
		mocks.requirePermission.mockImplementation(
			async (_context, resource: string) => {
				if (resource === "payment") {
					throw new Error("FORBIDDEN");
				}
			},
		);
		await expect(
			handler("/quotes/{id}/convert")({
				context,
				input: { id: quoteId },
			}),
		).rejects.toThrow("FORBIDDEN");
		expect(mocks.convert).not.toHaveBeenCalled();
	});
});
