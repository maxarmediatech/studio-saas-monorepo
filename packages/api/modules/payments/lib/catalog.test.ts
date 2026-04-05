import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("payment catalog identity", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv("DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY", "pdt_basics_month");
		vi.stubEnv("DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY", "pdt_basics_year");
		vi.stubEnv(
			"DODO_DISCOUNT_CODE_STUDIO_BASICS_MONTHLY_INTRO",
			"BASICS199",
		);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns server catalog metadata for checkout prices", async () => {
		const { getServerCatalogPrice } = await import(
			"@repo/payments/lib/catalog"
		);
		const monthly = getServerCatalogPrice("studio-basics-monthly");
		const yearly = getServerCatalogPrice("studio-basics-yearly");

		expect(monthly?.productId).toBe("pdt_basics_month");
		expect(monthly?.discountCode).toBe("BASICS199");
		expect(yearly?.productId).toBe("pdt_basics_year");
		expect(yearly?.discountCode).toBeUndefined();
	});

	it("maps known Dodo product IDs back to internal identity", async () => {
		const { resolvePurchaseIdentity } = await import(
			"@repo/payments/lib/catalog"
		);
		const identity = resolvePurchaseIdentity({
			type: "SUBSCRIPTION",
			productId: "pdt_basics_month",
		});

		expect(identity.planKey).toBe("studio-basics");
		expect(identity.priceKey).toBe("studio-basics-monthly");
		expect(identity.billingInterval).toBe("month");
	});

	it("falls back to legacy identity for unmapped rows", async () => {
		const { resolvePurchaseIdentity } = await import(
			"@repo/payments/lib/catalog"
		);
		const identity = resolvePurchaseIdentity({
			type: "ONE_TIME",
			productId: "legacy_product",
		});

		expect(identity.planKey).toBe("legacy-unknown");
		expect(identity.priceKey).toBe("legacy_product");
		expect(identity.billingInterval).toBe("one_time");
	});
});
