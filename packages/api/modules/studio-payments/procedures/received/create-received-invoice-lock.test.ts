import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	let handler:
		| ((options: {
				input: Record<string, unknown>;
				context: {
					organizationId: string;
					user: { id: string; name?: string };
				};
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
		query: { invoices: { findFirst: vi.fn() } },
	};

	return {
		chain,
		getHandler: () => handler,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedInvoiceForReceipt: vi.fn(),
		mockGetLockedScheduleForReceipt: vi.fn(),
		mockCreateReceivedPaymentIdempotently: vi.fn(),
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

vi.mock("../../../receipts/lib/locked-invoice-for-receipt", () => ({
	getLockedBookingForReceipt: mocks.mockGetLockedBookingForReceipt,
	getLockedInvoiceForReceipt: mocks.mockGetLockedInvoiceForReceipt,
	getLockedScheduleForReceipt: mocks.mockGetLockedScheduleForReceipt,
}));

vi.mock("../../../receipts/lib/receipt-helpers", () => ({
	generateReceiptNumber: vi.fn(),
	updateInvoicePaymentStatus: vi.fn(),
}));

vi.mock("../../lib/payment-idempotency", () => ({
	createReceivedPaymentIdempotently:
		mocks.mockCreateReceivedPaymentIdempotently,
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
	invoices: {},
	isNull: vi.fn((column: unknown) => ({ column })),
	paymentSchedules: {},
	receipts: {},
	receivedAmounts: {},
	sql: vi.fn(),
}));

import { createReceivedPaymentTransition } from "../../lib/schedule-payment-service";
import "./create-received";

describe("create received invoice locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tx.query.invoices.findFirst.mockResolvedValue(null);
		mocks.mockCreateReceivedPaymentIdempotently.mockImplementation(
			async (tx, input) => {
				const result = await createReceivedPaymentTransition(tx, input);
				return {
					result: {
						data: { id: result.id },
						message: "Payment recorded successfully",
					},
					replayed: false,
				};
			},
		);
		mocks.mockGetLockedBookingForReceipt.mockResolvedValue({
			id: "booking_1",
			name: "Booking",
		});
	});

	it("returns the stored response when an idempotent request replays", async () => {
		mocks.mockCreateReceivedPaymentIdempotently.mockResolvedValueOnce({
			result: {
				data: { id: "payment_1" },
				message: "Stored payment response",
			},
			replayed: true,
		});

		const response = await mocks.getHandler()?.({
			context: { organizationId: "org_1", user: { id: "user_1" } },
			input: {
				idempotencyKey: "payment-idempotency-key-1",
				bookingId: "booking_1",
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			},
		});

		expect(response).toEqual({
			data: { id: "payment_1" },
			message: "Stored payment response",
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

	it("re-reads the locked schedule and rejects an overpayment", async () => {
		mocks.mockGetLockedScheduleForReceipt.mockResolvedValue({
			id: "schedule_1",
			amount: "100.00",
			paidAmount: "80.00",
			paidAt: null,
			status: "partial",
		});
		const handler = mocks.getHandler();

		await expect(
			handler?.({
				context: { organizationId: "org_1", user: { id: "user_1" } },
				input: {
					bookingId: "booking_1",
					paymentScheduleId: "schedule_1",
					amount: "25.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
				},
			}),
		).rejects.toThrow("Amount cannot exceed remaining scheduled balance");

		expect(mocks.mockGetLockedScheduleForReceipt).toHaveBeenCalledWith(
			mocks.tx,
			{
				organizationId: "org_1",
				bookingId: "booking_1",
				paymentScheduleId: "schedule_1",
			},
		);
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});

	it("rejects an invoice that belongs to a different locked schedule", async () => {
		mocks.mockGetLockedInvoiceForReceipt.mockResolvedValue({
			id: "invoice_1",
			paymentScheduleId: "schedule_other",
		});
		mocks.mockGetLockedScheduleForReceipt.mockResolvedValue({
			id: "schedule_1",
			amount: "100.00",
			paidAmount: "0.00",
			paidAt: null,
			status: "pending",
		});

		await expect(
			mocks.getHandler()?.({
				context: { organizationId: "org_1", user: { id: "user_1" } },
				input: {
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					paymentScheduleId: "schedule_1",
					amount: "100.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
				},
			}),
		).rejects.toThrow(
			"Invoice does not belong to the selected payment schedule",
		);
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});
});
