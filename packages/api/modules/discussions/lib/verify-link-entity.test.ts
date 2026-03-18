import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyLinkEntityExists } from "./verify-link-entity";

const mocks = vi.hoisted(() => {
	const chain = {
		from: vi.fn(),
		where: vi.fn(),
		limit: vi.fn(),
	};

	return {
		mockHasPermission: vi.fn(),
		mockSelect: vi.fn(() => chain),
		mockFrom: chain.from,
		mockWhere: chain.where,
		mockLimit: chain.limit,
		chain,
	};
});

vi.mock("../../studio/lib/permissions", () => ({
	hasPermission: mocks.mockHasPermission,
}));

vi.mock("@repo/database", () => ({
	db: {
		select: mocks.mockSelect,
	},
	and: vi.fn((...args) => args),
	eq: vi.fn((a, b) => ({ eq: [a, b] })),
	isNull: vi.fn((a) => ({ isNull: a })),
	bookings: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
	shoots: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
	tasks: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
	deliverables: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
	paymentSchedules: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
	expenses: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
}));

const context = {
	headers: new Headers(),
	organizationId: "org_1",
};

describe("verifyLinkEntityExists", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockFrom.mockReturnValue(mocks.chain);
		mocks.mockWhere.mockReturnValue(mocks.chain);
		mocks.mockLimit.mockResolvedValue([]);
	});

	it("returns false without permission and skips the entity query", async () => {
		mocks.mockHasPermission.mockResolvedValue(false);

		const result = await verifyLinkEntityExists(
			"booking",
			"booking_1",
			context,
		);

		expect(result).toBe(false);
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(3);
		expect(mocks.mockSelect).not.toHaveBeenCalled();
	});

	it("returns true when the user has list access and the entity exists", async () => {
		mocks.mockHasPermission
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		mocks.mockLimit.mockResolvedValue([{ id: "booking_1" }]);

		const result = await verifyLinkEntityExists(
			"booking",
			"booking_1",
			context,
		);

		expect(result).toBe(true);
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(2);
		expect(mocks.mockSelect).toHaveBeenCalledOnce();
	});

	it("accepts reference access for booking links", async () => {
		mocks.mockHasPermission
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		mocks.mockLimit.mockResolvedValue([{ id: "booking_1" }]);

		const result = await verifyLinkEntityExists(
			"booking",
			"booking_1",
			context,
		);

		expect(result).toBe(true);
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(3);
		expect(mocks.mockSelect).toHaveBeenCalledOnce();
	});

	it("accepts reference access for payment schedule links", async () => {
		mocks.mockHasPermission
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce(true);
		mocks.mockLimit.mockResolvedValue([{ id: "schedule_1" }]);

		const result = await verifyLinkEntityExists(
			"payment_schedule",
			"schedule_1",
			context,
		);

		expect(result).toBe(true);
		expect(mocks.mockHasPermission).toHaveBeenCalledTimes(3);
		expect(mocks.mockSelect).toHaveBeenCalledOnce();
	});
});
