import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let handler:
		| ((options: {
				input: Record<string, unknown>;
				context: { organizationId: string; user: { id: string } };
		  }) => Promise<unknown>)
		| null = null;
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((nextHandler) => {
			handler = nextHandler;
			return chain;
		}),
	};
	const tx = {
		insert: vi.fn(),
		update: vi.fn(),
		query: {
			paymentSchedules: { findFirst: vi.fn() },
			receipts: { findFirst: vi.fn() },
			receivedAmounts: { findFirst: vi.fn() },
		},
	};

	return {
		chain,
		getHandler: () => handler,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedScheduleForReceipt: vi.fn(),
		mockGetLockedScheduleInvoiceForReceipt: vi.fn(),
		mockRequirePermission: vi.fn(),
		mockTransaction: vi.fn(async (callback) => callback(tx)),
		tx,
	};
});

vi.mock("../../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../../studio/lib/permissions", () => ({
	requirePermission: mocks.mockRequirePermission,
}));

vi.mock("../../../activities/lib", () => ({
	formatAmount: vi.fn((amount: string) => amount),
	safeTrackActivity: vi.fn(),
}));

vi.mock("../../../receipts/lib/locked-invoice-for-receipt", () => ({
	getLockedBookingForReceipt: mocks.mockGetLockedBookingForReceipt,
	getLockedScheduleForReceipt: mocks.mockGetLockedScheduleForReceipt,
	getLockedScheduleInvoiceForReceipt:
		mocks.mockGetLockedScheduleInvoiceForReceipt,
}));

vi.mock("../../../receipts/lib/receipt-helpers", () => ({
	generateReceiptNumber: vi.fn(),
	updateInvoicePaymentStatus: vi.fn(),
}));

vi.mock("../../../studio/lib/money", () => ({
	centsToMoney: vi.fn((cents: number) => (cents / 100).toFixed(2)),
	moneyToCents: vi.fn((money: string) => Math.round(Number(money) * 100)),
}));

vi.mock("@repo/database", () => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	bookings: {},
	db: { transaction: mocks.mockTransaction },
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	invoices: {},
	isNull: vi.fn((column: unknown) => ({ column })),
	paymentSchedules: {
		deletedAt: "deletedAt",
		id: "scheduleId",
		organizationId: "scheduleOrganizationId",
	},
	receipts: {},
	receivedAmounts: {},
	sql: vi.fn(),
}));

import "./convert-schedule";

describe("schedule conversion invoice locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tx.query.paymentSchedules.findFirst.mockResolvedValue({
			id: "schedule_1",
			organizationId: "org_1",
			bookingId: "booking_1",
			name: "Final payment",
			amount: "100.00",
			paidAmount: "0.00",
			paidAt: null,
			status: "pending",
		});
		mocks.mockGetLockedBookingForReceipt.mockResolvedValue({
			id: "booking_1",
			name: "Booking",
		});
		mocks.mockGetLockedScheduleForReceipt.mockResolvedValue({
			id: "schedule_1",
			organizationId: "org_1",
			bookingId: "booking_1",
			name: "Final payment",
			amount: "100.00",
			paidAmount: "0.00",
			paidAt: null,
			status: "pending",
		});
	});

	it("rejects a cancelled linked invoice before creating the payment", async () => {
		mocks.mockGetLockedScheduleInvoiceForReceipt.mockRejectedValue(
			new Error("Cannot issue a receipt for a cancelled invoice"),
		);
		const handler = mocks.getHandler();
		expect(handler).not.toBeNull();

		await expect(
			handler?.({
				context: {
					organizationId: "org_1",
					user: { id: "user_1" },
				},
				input: {
					scheduleId: "schedule_1",
					amount: "100.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
				},
			}),
		).rejects.toThrow("Cannot issue a receipt for a cancelled invoice");

		expect(
			mocks.mockGetLockedScheduleInvoiceForReceipt,
		).toHaveBeenCalledWith(mocks.tx, {
			organizationId: "org_1",
			bookingId: "booking_1",
			paymentScheduleId: "schedule_1",
		});
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});

	it("locks booking, invoice, then schedule on a successful conversion", async () => {
		const order: string[] = [];
		mocks.mockGetLockedBookingForReceipt.mockImplementation(async () => {
			order.push("booking");
			return { id: "booking_1", name: "Booking" };
		});
		mocks.mockGetLockedScheduleInvoiceForReceipt.mockImplementation(
			async () => {
				order.push("invoice");
				return null;
			},
		);
		mocks.mockGetLockedScheduleForReceipt.mockImplementation(async () => {
			order.push("schedule");
			return {
				id: "schedule_1",
				bookingId: "booking_1",
				name: "Final payment",
				amount: "100.00",
				paidAmount: "0.00",
				paidAt: null,
				status: "pending",
			};
		});
		mocks.tx.insert.mockReturnValue({
			values: vi.fn(() => ({
				returning: vi.fn(async () => [{ id: "received_1" }]),
			})),
		});
		mocks.tx.update.mockReturnValue({
			set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
		});

		const result = await mocks.getHandler()?.({
			context: { organizationId: "org_1", user: { id: "user_1" } },
			input: {
				scheduleId: "schedule_1",
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			},
		});

		expect(order).toEqual(["booking", "invoice", "schedule"]);
		expect(result).toMatchObject({ data: { receivedId: "received_1" } });
	});
});
