import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getMembership: vi.fn(),
	getPurchase: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	getOrganizationMembership: mocks.getMembership,
	getPurchaseById: mocks.getPurchase,
}));

import { getManageablePurchase } from "./get-manageable-purchase";

describe("getManageablePurchase", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getPurchase.mockResolvedValue({
			id: "purchase_1",
			organizationId: "org_1",
			userId: null,
		});
	});

	it("allows an owner when roles are stored as a normalized multi-role value", async () => {
		mocks.getMembership.mockResolvedValue({ role: "owner,admin" });

		await expect(
			getManageablePurchase({
				purchaseId: "purchase_1",
				userId: "user_1",
			}),
		).resolves.toMatchObject({ id: "purchase_1" });
	});

	it("rejects non-owners", async () => {
		mocks.getMembership.mockResolvedValue({ role: "admin" });

		await expect(
			getManageablePurchase({
				purchaseId: "purchase_1",
				userId: "user_1",
			}),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
