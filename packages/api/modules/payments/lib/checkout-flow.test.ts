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
		organizationId: "org_1",
		userId: null,
		type: "SUBSCRIPTION",
		customerId: "customer_1",
		subscriptionId: "sub_1",
		paymentId: null,
		productId: "pdt_starter_month",
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
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_FREELANCER_MONTHLY", "pdt_sub_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_FREELANCER_YEARLY", "pdt_sub_year");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY", "pdt_starter_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY", "pdt_starter_year");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_GROWTH_MONTHLY", "pdt_growth_month");
		vi.stubEnv("NEXT_PUBLIC_PRICE_ID_GROWTH_YEARLY", "pdt_growth_year");
		vi.stubEnv(
			"NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY_SETUP",
			"pdt_setup_month",
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("builds a completion URL on the app origin", async () => {
		const { buildCheckoutCompletionUrl } = await import(
			"@repo/payments/lib/checkout"
		);
		const url = buildCheckoutCompletionUrl({
			postCheckoutPath: "/app/acme/settings/billing",
			expectedProductIds: ["pdt_starter_month", "pdt_setup_month"],
		});

		expect(url).toBe(
			"https://app.example.com/checkout/complete?redirectTo=%2Fapp%2Facme%2Fsettings%2Fbilling&products=pdt_starter_month%2Cpdt_setup_month",
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

	it("keeps checkout status pending when only bundled setup purchase exists", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_setup",
					type: "ONE_TIME",
					subscriptionId: null,
					paymentId: "pay_setup",
					productId: "pdt_setup_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month", "pdt_setup_month"],
		});

		expect(status.status).toBe("pending");
	});

	it("waits for the expected product instead of reusing an older active plan", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_old",
					productId: "pdt_sub_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month"],
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
					productId: "pdt_starter_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month"],
		});

		expect(status.status).toBe("pending");
	});

	it("surfaces checkout session failure even when an older purchase for the same product exists", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			checkoutSessionPaymentStatus: "failed",
			purchases: [
				makePurchase({
					id: "purchase_old",
					productId: "pdt_starter_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month"],
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
					productId: "pdt_starter_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month"],
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
					productId: "pdt_starter_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month"],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_new");
	});

	it("activates checkout status once the expected subscription product is active", async () => {
		const { getCheckoutStatusFromPurchases } = await import(
			"@repo/payments/lib/checkout"
		);
		const status = getCheckoutStatusFromPurchases({
			purchases: [
				makePurchase({
					id: "purchase_new",
					productId: "pdt_starter_month",
					status: "active",
				}),
			],
			expectedProductIds: ["pdt_starter_month", "pdt_setup_month"],
		});

		expect(status.status).toBe("active");
		expect(status.purchaseId).toBe("purchase_new");
	});
});
