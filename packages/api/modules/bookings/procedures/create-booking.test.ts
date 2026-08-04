import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (args: {
	context: Record<string, unknown>;
	input: Record<string, unknown>;
}) => Promise<unknown>;

const mocks = vi.hoisted(() => {
	let handler: Handler | undefined;
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((value: Handler) => {
			handler = value;
			return chain;
		}),
	};
	return {
		chain,
		getHandler: () => handler,
		tx: { marker: "transaction" },
		requirePermission: vi.fn(),
		withTransaction: vi.fn(),
		materialize: vi.fn(),
		track: vi.fn(),
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));
vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.requirePermission,
}));
vi.mock("../../studio/lib/transactions", () => ({
	withTransaction: mocks.withTransaction,
}));
vi.mock("../lib/materialize-booking", () => ({
	materializeBooking: mocks.materialize,
}));
vi.mock("../../activities/lib", () => ({
	trackActivityWithExecutor: mocks.track,
}));

const context = {
	organizationId: "org_1",
	user: { id: "user_1", name: "Owner" },
	membership: { organization: { name: "Studio One" } },
};
const input = {
	name: "Booking",
	bookingDate: "2026-08-01",
	bookingType: "wedding",
	packageType: "premium",
	packageCost: "100.00",
	participants: [],
};

describe("create booking activity transaction", () => {
	beforeAll(async () => {
		await import("./create-booking");
	});

	beforeEach(() => {
		vi.clearAllMocks();
		mocks.withTransaction.mockImplementation(
			async (callback: (tx: unknown) => Promise<unknown>) =>
				callback(mocks.tx),
		);
		mocks.materialize.mockResolvedValue({
			id: "booking_1",
			referenceNumber: "SO-2608-0001",
		});
		mocks.track.mockResolvedValue(undefined);
	});

	it("writes booking-created activity through the owning transaction", async () => {
		const handler = mocks.getHandler();
		if (!handler) {
			throw new Error("Missing create booking handler");
		}
		await handler({ context, input });
		expect(mocks.track).toHaveBeenCalledWith(
			mocks.tx,
			{ organizationId: "org_1", user: context.user },
			expect.objectContaining({
				entityType: "booking",
				entityId: "booking_1",
				action: "created",
			}),
		);
	});

	it("propagates activity failure through the transaction boundary", async () => {
		const handler = mocks.getHandler();
		if (!handler) {
			throw new Error("Missing create booking handler");
		}
		mocks.track.mockRejectedValue(new Error("activity failed"));
		await expect(handler({ context, input })).rejects.toThrow(
			"activity failed",
		);
	});
});
