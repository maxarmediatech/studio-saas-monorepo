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
		mockGetOrganizationMembership: vi.fn(),
		mockGetPurchasesByOrganizationId: vi.fn(),
		mockGetPurchasesByUserId: vi.fn(),
		mockGetCheckoutSessionStatus: vi.fn(),
		mockGetCheckoutStatusFromPurchases: vi.fn(),
		mockLoggerError: vi.fn(),
		mockLoggerInfo: vi.fn(),
		procedureChain,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	protectedProcedure: mocks.procedureChain,
}));

vi.mock("@repo/config", () => ({
	config: {
		organizations: {
			enable: true,
			enableBilling: true,
		},
		users: {
			enableBilling: false,
		},
	},
}));

vi.mock("@repo/database", () => ({
	getOrganizationMembership: mocks.mockGetOrganizationMembership,
	getPurchasesByOrganizationId: mocks.mockGetPurchasesByOrganizationId,
	getPurchasesByUserId: mocks.mockGetPurchasesByUserId,
}));

vi.mock("@repo/logs", () => ({
	logger: {
		error: mocks.mockLoggerError,
		info: mocks.mockLoggerInfo,
	},
}));

vi.mock("@repo/payments", () => ({
	getCheckoutSessionStatus: mocks.mockGetCheckoutSessionStatus,
}));

vi.mock("@repo/payments/lib/catalog", () => ({
	hydratePurchaseIdentity: (purchase: unknown) => purchase,
}));

vi.mock("@repo/payments/lib/checkout", () => ({
	getCheckoutStatusFromPurchases: mocks.mockGetCheckoutStatusFromPurchases,
	sanitizeCheckoutSessionId: (value: string) => value.trim(),
}));

import "./get-checkout-status";

describe("getCheckoutStatus procedure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockGetOrganizationMembership.mockResolvedValue({
			role: "owner",
		});
		mocks.mockGetPurchasesByOrganizationId.mockResolvedValue([
			{
				id: "purchase_1",
				subscriptionId: "sub_1",
				paymentId: null,
				priceKey: "studio-basics-monthly",
				planKey: "studio-basics",
				billingInterval: "month",
				status: "active",
			},
		]);
		mocks.mockGetPurchasesByUserId.mockResolvedValue([]);
		mocks.mockGetCheckoutStatusFromPurchases.mockReturnValue({
			status: "active",
			purchaseId: "purchase_1",
		});
	});

	it("falls back to subscription recovery when checkout session lookup is stale", async () => {
		mocks.mockGetCheckoutSessionStatus.mockRejectedValue({ status: 404 });

		await expect(
			mocks.handler({
				input: {
					checkoutSessionId: "cks_1",
					subscriptionId: "sub_1",
					organizationId: "org_1",
					expectedPriceKeys: ["studio-basics-monthly"],
				},
				context: { user: { id: "user_1" } },
			}),
		).resolves.toEqual({
			status: "active",
			purchaseId: "purchase_1",
		});

		expect(mocks.mockLoggerInfo).toHaveBeenCalledWith(
			"Ignoring stale checkout session lookup during subscription-based recovery",
			expect.objectContaining({
				checkoutSessionId: "cks_1",
				subscriptionId: "sub_1",
				status: 404,
			}),
		);
		expect(mocks.mockGetCheckoutStatusFromPurchases).toHaveBeenCalledWith(
			expect.objectContaining({
				checkoutSessionPaymentId: null,
				checkoutSessionPaymentStatus: null,
				checkoutSessionSubscriptionId: "sub_1",
				expectedPriceKeys: ["studio-basics-monthly"],
			}),
		);
	});

	it("still rejects stale checkout sessions without subscription recovery context", async () => {
		mocks.mockGetCheckoutSessionStatus.mockRejectedValue({ status: 404 });

		await expect(
			mocks.handler({
				input: {
					checkoutSessionId: "cks_1",
					organizationId: "org_1",
					expectedPriceKeys: ["studio-basics-monthly"],
				},
				context: { user: { id: "user_1" } },
			}),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe("BAD_REQUEST");
			return true;
		});

		expect(mocks.mockGetCheckoutStatusFromPurchases).not.toHaveBeenCalled();
	});
});
