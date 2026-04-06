import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
		organizationId: "org_1",
		userId: null,
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

describe("checkout flow helpers", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.example.com");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("builds a completion URL with expected price keys", async () => {
		const { buildCheckoutCompletionUrl } = await import(
			"@repo/payments/lib/checkout"
		);
		const url = buildCheckoutCompletionUrl({
			postCheckoutPath: "/app/stuwiz/settings/billing",
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(url).toBe(
			"https://app.example.com/checkout/complete?redirectTo=%2Fapp%2Fstuwiz%2Fsettings%2Fbilling&prices=studio-basics-monthly",
		);
	});

	it("builds a completion URL for collection checkout with both basics prices", async () => {
		const { buildCheckoutCompletionUrl } = await import(
			"@repo/payments/lib/checkout"
		);
		const url = buildCheckoutCompletionUrl({
			postCheckoutPath: "/app",
			expectedPriceKeys: [
				"studio-basics-monthly",
				"studio-basics-yearly",
			],
		});

		expect(url).toBe(
			"https://app.example.com/checkout/complete?redirectTo=%2Fapp&prices=studio-basics-monthly%2Cstudio-basics-yearly",
		);
	});

	it("rejects external checkout URLs and only allows exact Dodo hosts", async () => {
		const { isAllowedDodoCheckoutUrl } = await import(
			"@repo/payments/lib/checkout"
		);

		expect(
			isAllowedDodoCheckoutUrl(
				"https://checkout.dodopayments.com/buy/test",
			),
		).toBe(true);
		expect(
			isAllowedDodoCheckoutUrl(
				"https://checkout.dodopayments.com.evil.test/buy/test",
			),
		).toBe(false);
		expect(isAllowedDodoCheckoutUrl("https://evil.test/checkout")).toBe(
			false,
		);
	});

	it("waits for the expected price instead of reusing another active purchase", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_yearly",
					priceKey: "studio-basics-yearly",
					billingInterval: "year",
					productId: "pdt_basics_year",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("pending");
	});

	it("does not treat an older active purchase as success while the current checkout session is still processing", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionPaymentStatus: "processing",
			purchases: [
				makePurchase({
					id: "purchase_old",
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("pending");
	});

	it("surfaces checkout session failure even when an older purchase for the same price exists", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionPaymentStatus: "failed",
			purchases: [
				makePurchase({
					id: "purchase_old",
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("failed");
	});

	it("keeps checkout pending when a successful session has no matching purchase yet", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionPaymentId: "pay_new",
			checkoutSessionPaymentStatus: "succeeded",
			purchases: [
				makePurchase({
					id: "purchase_old",
					paymentId: "pay_old",
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("pending");
	});

	it("activates checkout only when the matching session payment purchase is present", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionPaymentId: "pay_new",
			checkoutSessionPaymentStatus: "succeeded",
			purchases: [
				makePurchase({
					id: "purchase_new",
					paymentId: "pay_new",
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_new");
	});

	it("activates checkout when the completion URL subscription id matches the active purchase", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionSubscriptionId: "sub_new",
			checkoutSessionPaymentStatus: "active",
			purchases: [
				makePurchase({
					id: "purchase_new",
					subscriptionId: "sub_new",
					paymentId: null,
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_new");
	});

	it("activates checkout status once the expected subscription price is active", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_new",
					priceKey: "studio-basics-monthly",
					status: "active",
				}),
			],
			expectedPriceKeys: ["studio-basics-monthly"],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_new");
	});

	it("activates collection checkout once either basics billing interval is active", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_yearly",
					priceKey: "studio-basics-yearly",
					billingInterval: "year",
					productId: "pdt_basics_year",
					status: "active",
				}),
			],
			expectedPriceKeys: [
				"studio-basics-monthly",
				"studio-basics-yearly",
			],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_yearly");
	});
});
