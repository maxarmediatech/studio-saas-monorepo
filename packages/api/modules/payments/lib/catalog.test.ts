import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("payment catalog identity", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.stubEnv(
			"DODO_PRODUCT_COLLECTION_ID_STUDIO_BASICS",
			"pdc_basics_collection",
		);
		vi.stubEnv("DODO_PRODUCT_ID_STUDIO_BASICS_MONTHLY", "pdt_basics_month");
		vi.stubEnv("DODO_PRODUCT_ID_STUDIO_BASICS_YEARLY", "pdt_basics_year");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns server catalog metadata for checkout prices", async () => {
		const { getServerCatalogPlan, getServerCatalogPrice } = await import(
			"@repo/payments/lib/catalog"
		);
		const monthly = getServerCatalogPrice("studio-basics-monthly");
		const yearly = getServerCatalogPrice("studio-basics-yearly");
		const plan = getServerCatalogPlan("studio-basics");

		expect(monthly?.productId).toBe("pdt_basics_month");
		expect(yearly?.productId).toBe("pdt_basics_year");
		expect(plan?.productCollectionId).toBe("pdc_basics_collection");
		expect(plan?.expectedPriceKeys).toEqual([
			"studio-basics-monthly",
			"studio-basics-yearly",
		]);
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
