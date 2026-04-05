import { ORPCError } from "@orpc/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let capturedHandler:
		| ((options: {
				input: Record<string, unknown>;
				context: {
					user: {
						id: string;
						email: string;
						name: string | null;
					};
				};
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
		mockGetOrganizationMembership: vi.fn(),
		mockGetOrganizationById: vi.fn(),
		mockGetCustomerIdFromEntity: vi.fn(),
		mockCreateCheckoutLink: vi.fn(),
		procedureChain,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	protectedProcedure: mocks.procedureChain,
}));

vi.mock("../../../orpc/middleware/locale-middleware", () => ({
	localeMiddleware: {},
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
		payments: {
			plans: {
				"studio-basics": {
					prices: [
						{
							type: "recurring",
							priceKey: "studio-basics-monthly",
							interval: "month",
							amount: 999,
							currency: "INR",
						},
						{
							type: "recurring",
							priceKey: "studio-basics-yearly",
							interval: "year",
							amount: 9990,
							currency: "INR",
						},
					],
				},
				"studio-advance": {
					comingSoon: true,
				},
			},
		},
	},
}));

vi.mock("@repo/database", () => ({
	getOrganizationMembership: mocks.mockGetOrganizationMembership,
	getOrganizationById: mocks.mockGetOrganizationById,
}));

vi.mock("@repo/payments", () => ({
	createCheckoutLink: mocks.mockCreateCheckoutLink,
	getCustomerIdFromEntity: mocks.mockGetCustomerIdFromEntity,
}));

vi.mock("@repo/payments/lib/catalog", () => ({
	getConfiguredPrice: vi.fn((priceKey: string) => {
		if (priceKey === "studio-basics-monthly") {
			return {
				type: "recurring",
				priceKey: "studio-basics-monthly",
				interval: "month",
				amount: 999,
				currency: "INR",
			};
		}

		if (priceKey === "studio-basics-yearly") {
			return {
				type: "recurring",
				priceKey: "studio-basics-yearly",
				interval: "year",
				amount: 9990,
				currency: "INR",
			};
		}

		if (priceKey === "studio-advance-monthly") {
			return {
				type: "recurring",
				priceKey: "studio-advance-monthly",
				interval: "month",
				amount: 2999,
				currency: "INR",
			};
		}

		return null;
	}),
	getServerCatalogPrice: vi.fn((priceKey: string) => {
		if (priceKey === "studio-basics-monthly") {
			return {
				priceKey: "studio-basics-monthly",
				planKey: "studio-basics",
				billingInterval: "month",
				productId: "pdt_basics_month",
			};
		}

		if (priceKey === "studio-basics-yearly") {
			return {
				priceKey: "studio-basics-yearly",
				planKey: "studio-basics",
				billingInterval: "year",
				productId: "pdt_basics_year",
			};
		}

		if (priceKey === "studio-advance-monthly") {
			return {
				priceKey: "studio-advance-monthly",
				planKey: "studio-advance",
				billingInterval: "month",
				productId: "pdt_advance_month",
			};
		}

		return null;
	}),
	getServerCatalogPlan: vi.fn((planKey: string) => {
		if (planKey === "studio-basics") {
			return {
				planKey: "studio-basics",
				productCollectionId: "pdc_basics_collection",
				expectedPriceKeys: [
					"studio-basics-monthly",
					"studio-basics-yearly",
				],
			};
		}

		return null;
	}),
}));

vi.mock("@repo/auth/lib/permissions", () => ({
	hasAnyRole: vi.fn((role: string, allowed: string[]) =>
		allowed.includes(role),
	),
}));

vi.mock("@repo/env", () => ({
	isEnvConfigError: vi.fn(() => false),
}));

vi.mock("@repo/logs", () => ({
	logger: {
		error: vi.fn(),
	},
}));

import "./create-checkout-link";

describe("createCheckoutLink procedure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockGetOrganizationMembership.mockResolvedValue({
			role: "owner",
		});
		mocks.mockGetOrganizationById.mockResolvedValue({
			id: "org_1",
			members: [{ id: "user_1" }],
		});
		mocks.mockGetCustomerIdFromEntity.mockResolvedValue("cus_1");
		mocks.mockCreateCheckoutLink.mockResolvedValue({
			checkoutLink:
				"https://test.checkout.dodopayments.com/session/cks_1",
			checkoutSessionId: "cks_1",
		});
	});

	it("uses the product collection for Studio Basics checkout", async () => {
		await expect(
			mocks.handler({
				input: {
					priceKey: "studio-basics-monthly",
					organizationId: "org_1",
					postCheckoutPath: "/app",
				},
				context: {
					user: {
						id: "user_1",
						email: "rakesh@example.com",
						name: "Rakesh",
					},
				},
			}),
		).resolves.toEqual({
			checkoutLink:
				"https://test.checkout.dodopayments.com/session/cks_1",
			checkoutSessionId: "cks_1",
			requiresHostedCheckout: true,
		});

		expect(mocks.mockCreateCheckoutLink).toHaveBeenCalledWith(
			expect.objectContaining({
				priceKey: "studio-basics-monthly",
				productCollectionId: "pdc_basics_collection",
				productId: "pdt_basics_month",
				expectedPriceKeys: [
					"studio-basics-monthly",
					"studio-basics-yearly",
				],
			}),
		);
	});

	it("rejects coming-soon plans", async () => {
		await expect(
			mocks.handler({
				input: {
					priceKey: "studio-advance-monthly",
					organizationId: "org_1",
				},
				context: {
					user: {
						id: "user_1",
						email: "rakesh@example.com",
						name: "Rakesh",
					},
				},
			}),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe("BAD_REQUEST");
			return true;
		});
	});

	it("fails when collection checkout is missing mapped product ids", async () => {
		const { getServerCatalogPrice } = await import(
			"@repo/payments/lib/catalog"
		);

		vi.mocked(getServerCatalogPrice).mockImplementation(
			(priceKey: string): any => {
				if (priceKey === "studio-basics-monthly") {
					return {
						priceKey: "studio-basics-monthly",
						planKey: "studio-basics",
						billingInterval: "month",
						productId: "",
					};
				}

				if (priceKey === "studio-basics-yearly") {
					return {
						priceKey: "studio-basics-yearly",
						planKey: "studio-basics",
						billingInterval: "year",
						productId: "pdt_basics_year",
					};
				}

				return null;
			},
		);

		await expect(
			mocks.handler({
				input: {
					priceKey: "studio-basics-monthly",
					organizationId: "org_1",
				},
				context: {
					user: {
						id: "user_1",
						email: "rakesh@example.com",
						name: "Rakesh",
					},
				},
			}),
		).rejects.toSatisfy((error: unknown) => {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as { code?: string }).code).toBe(
				"INTERNAL_SERVER_ERROR",
			);
			return true;
		});

		expect(mocks.mockCreateCheckoutLink).not.toHaveBeenCalled();
	});
});
