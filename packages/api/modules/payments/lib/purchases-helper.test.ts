import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type PurchaseRecord = {
	id: string;
	organizationId: string | null;
	userId: string | null;
	type: "SUBSCRIPTION" | "ONE_TIME";
	customerId: string;
	subscriptionId: string | null;
	paymentId: string | null;
	productId: string;
	status: string | null;
	createdAt: Date;
	updatedAt: Date | null;
};

function makePurchase(overrides: Partial<PurchaseRecord>): PurchaseRecord {
	return {
		id: "purchase_1",
		organizationId: null,
		userId: "user_1",
		type: "SUBSCRIPTION",
		customerId: "customer_1",
		subscriptionId: "sub_1",
		paymentId: null,
		productId: "pdt_sub_month",
		status: "active",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("createPurchasesHelper", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_FREELANCER_MONTHLY", "pdt_sub_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_FREELANCER_YEARLY", "pdt_sub_year");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY", "pdt_starter_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY", "pdt_starter_year");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_GROWTH_MONTHLY", "pdt_growth_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_GROWTH_YEARLY", "pdt_growth_year");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("does not grant active purchase from failed one-time payments", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([
			makePurchase({
				id: "purchase_failed",
				type: "ONE_TIME",
				subscriptionId: null,
				paymentId: "pay_failed",
				status: "failed",
			}),
		]);

		expect(
			helper.activePlan === null ||
				helper.activePlan.hasActivePurchase === false,
		).toBe(true);
	});

	it("prefers active subscriptions even if newer failed subscription exists", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([
			makePurchase({
				id: "purchase_new_failed",
				subscriptionId: "sub_failed",
				status: "failed",
				updatedAt: new Date("2026-01-03T00:00:00.000Z"),
			}),
			makePurchase({
				id: "purchase_old_active",
				subscriptionId: "sub_active",
				status: "active",
				updatedAt: new Date("2026-01-01T00:00:00.000Z"),
			}),
		]);

		expect(helper.activePlan?.hasActivePurchase).toBe(true);
		expect(helper.activePlan?.status).toBe("active");
		expect(helper.activePlan?.purchaseId).toBe("purchase_old_active");
	});

	it("builds mixed-cart compatible one-time entitlement only for non-failed statuses", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([
			makePurchase({
				id: "purchase_setup_paid",
				type: "ONE_TIME",
				subscriptionId: null,
				paymentId: "pay_setup",
				status: "active",
			}),
		]);

		expect(helper.activePlan?.hasActivePurchase).toBe(true);
		expect(helper.activePlan?.status).toBe("active");
		expect(helper.activePlan?.purchaseId).toBe("purchase_setup_paid");
	});
});
