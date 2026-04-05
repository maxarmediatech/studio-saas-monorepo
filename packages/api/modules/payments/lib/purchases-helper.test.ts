import { describe, expect, it } from "vitest";

type PurchaseRecord = {
	id: string;
	organizationId: string | null;
	userId: string | null;
	type: "SUBSCRIPTION" | "ONE_TIME";
	customerId: string;
	subscriptionId: string | null;
	paymentId: string | null;
	planKey: string;
	priceKey: string;
	billingInterval: string | null;
	catalogVersion: string;
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
		planKey: "studio-basics",
		priceKey: "studio-basics-monthly",
		billingInterval: "month",
		catalogVersion: "2026-04-basics",
		productId: "pdt_basics_month",
		status: "active",
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("createPurchasesHelper", () => {
	it("does not grant active purchase from one-time payments", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([
			makePurchase({
				id: "purchase_one_time",
				type: "ONE_TIME",
				subscriptionId: null,
				paymentId: "pay_one_time",
				status: "active",
			}),
		]);

		expect(helper.activePlan).toBeNull();
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

	it("resolves the active plan from stored price identity", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([
			makePurchase({
				priceKey: "studio-basics-yearly",
				billingInterval: "year",
				productId: "pdt_basics_year",
			}),
		]);

		expect(helper.activePlan?.id).toBe("studio-basics");
		expect(helper.activePlan?.price?.priceKey).toBe("studio-basics-yearly");
	});

	it("matches purchases by internal plan key", async () => {
		const { createPurchasesHelper } = await import(
			"@repo/payments/lib/helper"
		);
		const helper = createPurchasesHelper([makePurchase({})]);

		expect(helper.hasPurchase("studio-basics")).toBe(true);
		expect(helper.hasSubscription("studio-basics")).toBe(true);
		expect(helper.hasPurchase("studio-advance")).toBe(false);
	});
});
