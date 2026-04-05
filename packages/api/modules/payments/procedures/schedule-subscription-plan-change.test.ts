import { ORPCError } from "@orpc/client";
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
		mockScheduleSubscriptionPlanChange: vi.fn(),
		mockGetConfiguredPrice: vi.fn(),
		mockGetServerCatalogPrice: vi.fn(),
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
	scheduleSubscriptionPlanChange: mocks.mockScheduleSubscriptionPlanChange,
}));

vi.mock("@repo/payments/lib/catalog", () => ({
	getConfiguredPrice: mocks.mockGetConfiguredPrice,
	getServerCatalogPrice: mocks.mockGetServerCatalogPrice,
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

import "./schedule-subscription-plan-change";

describe("scheduleSubscriptionPlanChange procedure", () => {
	beforeEach(() => {
		vi.clearAllMocks();

		mocks.mockGetManageablePurchase.mockResolvedValue({
			id: "purchase_1",
			type: "SUBSCRIPTION",
			subscriptionId: "sub_1",
			status: "active",
			productId: "pdt_basics_month",
			planKey: "studio-basics",
			priceKey: "studio-basics-monthly",
			billingInterval: "month",
			catalogVersion: "2026-04-basics",
		});
		mocks.mockGetConfiguredPrice.mockImplementation((priceKey: string) => {
			if (priceKey === "studio-basics-yearly") {
				return {
					type: "recurring",
					priceKey: "studio-basics-yearly",
					interval: "year",
					amount: 9990,
					currency: "INR",
				};
			}

			if (priceKey === "studio-basics-monthly") {
				return {
					type: "recurring",
					priceKey: "studio-basics-monthly",
					interval: "month",
					amount: 999,
					currency: "INR",
				};
			}

			return null;
		});
		mocks.mockGetServerCatalogPrice.mockImplementation(
			(priceKey: string) => {
				if (priceKey === "studio-basics-yearly") {
					return {
						priceKey: "studio-basics-yearly",
						planKey: "studio-basics",
						billingInterval: "year",
						productId: "pdt_basics_year",
					};
				}

				if (priceKey === "studio-basics-monthly") {
					return {
						priceKey: "studio-basics-monthly",
						planKey: "studio-basics",
						billingInterval: "month",
						productId: "pdt_basics_month",
					};
				}

				return null;
			},
		);
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			quantity: 3,
			status: "active",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: null,
		});
		mocks.mockResolvePurchaseIdentity.mockReturnValue({
			planKey: "studio-basics",
			priceKey: "studio-basics-monthly",
			billingInterval: "month",
			catalogVersion: "2026-04-basics",
		});
	});

	it("schedules the new price for the next billing date without proration", async () => {
		await expect(
			mocks.handler({
				input: {
					purchaseId: "purchase_1",
					targetPriceKey: "studio-basics-yearly",
				},
				context: { user: { id: "user_1" } },
			}),
		).resolves.toEqual({
			scheduledFor: "2026-05-06T00:00:00.000Z",
			targetPriceKey: "studio-basics-yearly",
		});

		expect(mocks.mockScheduleSubscriptionPlanChange).toHaveBeenCalledWith({
			id: "sub_1",
			productId: "pdt_basics_year",
			quantity: 3,
			effectiveAt: "next_billing_date",
			prorationBillingMode: "do_not_bill",
			onPaymentFailure: "prevent_change",
		});
	});

	it("rejects no-op billing changes", async () => {
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_year",
			quantity: 1,
			status: "active",
			cancelAtNextBillingDate: false,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: null,
		});
		mocks.mockResolvePurchaseIdentity.mockReturnValue({
			planKey: "studio-basics",
			priceKey: "studio-basics-yearly",
			billingInterval: "year",
			catalogVersion: "2026-04-basics",
		});

		await expect(
			mocks.handler({
				input: {
					purchaseId: "purchase_1",
					targetPriceKey: "studio-basics-yearly",
				},
				context: { user: { id: "user_1" } },
			}),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe("BAD_REQUEST");
			expect((error as { message?: string }).message).toContain(
				"That billing change is not available.",
			);
			return true;
		});

		expect(mocks.mockScheduleSubscriptionPlanChange).not.toHaveBeenCalled();
	});

	it("rejects subscriptions already scheduled to cancel", async () => {
		mocks.mockGetSubscriptionPlanState.mockResolvedValue({
			subscriptionId: "sub_1",
			productId: "pdt_basics_month",
			quantity: 1,
			status: "active",
			cancelAtNextBillingDate: true,
			nextBillingDate: "2026-05-06T00:00:00.000Z",
			scheduledChange: null,
		});

		await expect(
			mocks.handler({
				input: {
					purchaseId: "purchase_1",
					targetPriceKey: "studio-basics-yearly",
				},
				context: { user: { id: "user_1" } },
			}),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe("BAD_REQUEST");
			expect((error as { message?: string }).message).toContain(
				"scheduled to cancel",
			);
			return true;
		});

		expect(mocks.mockScheduleSubscriptionPlanChange).not.toHaveBeenCalled();
	});
});
