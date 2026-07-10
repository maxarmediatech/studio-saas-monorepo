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
	const tx = { insert: vi.fn() };

	return {
		chain,
		getHandler: () => handler,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedInvoiceForReceipt: vi.fn(),
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
	getLockedInvoiceForReceipt: mocks.mockGetLockedInvoiceForReceipt,
}));

vi.mock("../../../receipts/lib/receipt-helpers", () => ({
	generateReceiptNumber: vi.fn(),
	updateInvoicePaymentStatus: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	bookings: {
		deletedAt: "deletedAt",
		id: "bookingId",
		organizationId: "bookingOrganizationId",
	},
	db: {
		query: {
			paymentSchedules: { findFirst: vi.fn() },
		},
		transaction: mocks.mockTransaction,
	},
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	isNull: vi.fn((column: unknown) => ({ column })),
	paymentSchedules: {},
	receipts: {},
	receivedAmounts: {},
	sql: vi.fn(),
}));

import "./create-received";

describe("create received invoice locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.mockGetLockedBookingForReceipt.mockResolvedValue({
			id: "booking_1",
			name: "Booking",
		});
	});

	it("rejects a cancelled invoice before creating the payment", async () => {
		mocks.mockGetLockedInvoiceForReceipt.mockRejectedValue(
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
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					amount: "100.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
				},
			}),
		).rejects.toThrow("Cannot issue a receipt for a cancelled invoice");

		expect(mocks.mockGetLockedInvoiceForReceipt).toHaveBeenCalledWith(
			mocks.tx,
			{
				organizationId: "org_1",
				bookingId: "booking_1",
				invoiceId: "invoice_1",
			},
		);
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});
});
