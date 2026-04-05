import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: Record<string, unknown>;
				context: { user: { id: string } };
		  }) => Promise<unknown>)
		| undefined;

	const procedureChain = {
		use: vi.fn(() => procedureChain),
		route: vi.fn(() => procedureChain),
		input: vi.fn(() => procedureChain),
		handler: vi.fn((handler) => {
			capturedHandler = handler;
			return procedureChain;
		}),
	};

	return {
		get handler() {
			if (!capturedHandler) {
				throw new Error("Handler not captured");
			}

			return capturedHandler;
		},
		mockGetManageablePurchase: vi.fn(),
		mockGetSubscriptionPlanState: vi.fn(),
		mockResolvePurchaseIdentity: vi.fn(),
		mockIsEnvConfigError: vi.fn(() => false),
		mockLoggerError: vi.fn(),
		procedureChain,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	protectedProcedure: mocks.procedureChain,
}));

vi.mock("../../../orpc/middleware/locale-middleware", () => ({
	localeMiddleware: {},
}));

vi.mock("../lib/get-manageable-purchase", () => ({
	getManageablePurchase: mocks.mockGetManageablePurchase,
}));

vi.mock("@repo/payments", () => ({
	getSubscriptionPlanState: mocks.mockGetSubscriptionPlanState,
}));

vi.mock("@repo/payments/lib/catalog", () => ({
	resolvePurchaseIdentity: mocks.mockResolvePurchaseIdentity,
}));

vi.mock("@repo/env", () => ({
	isEnvConfigError: mocks.mockIsEnvConfigError,
}));

vi.mock("@repo/logs", () => ({
	logger: {
		error: mocks.mockLoggerError,
	},
}));

import "./get-subscription-plan-state";

describe("getSubscriptionPlanState procedure", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.mockGetManageablePurchase.mockResolvedValue({
			id: "purchase_1",
			type: "SUBSCRIPTION",
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			planKey: "studio-basics",
			priceKey: "studio-basics-monthly",
			billingInterval: "month",
			catalogVersion: "2026-04-basics",
		});
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			quantity: 1,
			status: "active",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: {
				id: "sch_1",
				productId: "pdt_basics_year",
				effectiveAt: "2026-05-06T00:00:00.000Z",
				quantity: 1,
			},
		});
		mocks.mockResolvePurchaseIdentity.mockImplementation(
			({ productId }: { productId: string }) => {
				if (productId === "pdt_basics_year") {
					return {
						planKey: "studio-basics",
						priceKey: "studio-basics-yearly",
						billingInterval: "year",
						catalogVersion: "2026-04-basics",
					};
				}

				return {
					planKey: "studio-basics",
					priceKey: "studio-basics-monthly",
					billingInterval: "month",
					catalogVersion: "2026-04-basics",
				};
			},
		);
	});

	it("returns the live billing interval plus scheduled change", async () => {
		await expect(
			mocks.handler({
				input: { purchaseId: "purchase_1" },
				context: { user: { id: "user_1" } },
			}),
		).resolves.toEqual({
			subscriptionId: "sub_1",
			status: "active",
			currentPlanKey: "studio-basics",
			currentPriceKey: "studio-basics-monthly",
			currentBillingInterval: "month",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: {
				id: "sch_1",
				planKey: "studio-basics",
				priceKey: "studio-basics-yearly",
				billingInterval: "year",
				effectiveAt: "2026-05-06T00:00:00.000Z",
			},
		});

		expect(mocks.mockGetManageablePurchase).toHaveBeenCalledWith({
			purchaseId: "purchase_1",
			userId: "user_1",
		});
		expect(mocks.mockGetSubscriptionPlanState).toHaveBeenCalledWith(
			"sub_1",
		);
	});
});
