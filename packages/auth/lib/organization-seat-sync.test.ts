import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getOrganization: vi.fn(),
	setSubscriptionSeats: vi.fn(),
	updateWhere: vi.fn(),
	price: {
		priceKey: "seat-price",
		type: "recurring" as const,
		amount: 100,
		currency: "INR",
		interval: "month" as const,
		seatBased: true,
	},
}));

vi.mock("@repo/config", () => ({
	config: {
		payments: {
			plans: { studio: { prices: [mocks.price] } },
		},
	},
}));

vi.mock("@repo/database", () => ({
	and: vi.fn(),
	calendarRouteChanges: {},
	crews: {},
	db: {
		query: { crews: { findFirst: vi.fn() } },
		update: vi.fn(() => ({
			set: vi.fn(() => ({ where: mocks.updateWhere })),
		})),
	},
	eq: vi.fn((left, right) => ({ left, right })),
	getOrganizationWithPurchasesAndMembersCount: mocks.getOrganization,
	ilike: vi.fn(),
	isNull: vi.fn(),
	organizations: { id: "organizations.id" },
	users: {},
}));

vi.mock("@repo/logs", () => ({
	logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock("@repo/payments", () => ({
	setSubscriptionSeats: mocks.setSubscriptionSeats,
}));

import { updateSeatsInOrganizationSubscription } from "./organization";

const purchase = {
	type: "SUBSCRIPTION",
	status: "active",
	subscriptionId: "subscription_1",
	priceKey: "seat-price",
	createdAt: new Date("2026-07-11T00:00:00.000Z"),
	updatedAt: null,
};

describe("organization subscription seat reconciliation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.price.seatBased = true;
		mocks.updateWhere.mockResolvedValue(undefined);
		mocks.setSubscriptionSeats.mockResolvedValue(undefined);
		mocks.getOrganization.mockResolvedValue({
			membersCount: 3,
			purchases: [purchase],
		});
	});

	it("does not alter plans unless the catalog explicitly marks them seat-based", async () => {
		mocks.price.seatBased = false;

		await expect(
			updateSeatsInOrganizationSubscription("org_1"),
		).resolves.toEqual({ status: "skipped", reason: "not_seat_based" });
		expect(mocks.setSubscriptionSeats).not.toHaveBeenCalled();
	});

	it("applies the database member count and records success", async () => {
		await expect(
			updateSeatsInOrganizationSubscription("org_1"),
		).resolves.toEqual({ status: "synced", seats: 3 });
		expect(mocks.setSubscriptionSeats).toHaveBeenCalledWith({
			id: "subscription_1",
			seats: 3,
		});
		expect(mocks.updateWhere).toHaveBeenCalled();
	});

	it("records provider failures for the periodic repair run", async () => {
		mocks.setSubscriptionSeats.mockRejectedValue(
			new Error("provider down"),
		);

		await expect(
			updateSeatsInOrganizationSubscription("org_1"),
		).resolves.toEqual({ status: "failed", error: "provider down" });
		expect(mocks.updateWhere).toHaveBeenCalled();
	});
});
