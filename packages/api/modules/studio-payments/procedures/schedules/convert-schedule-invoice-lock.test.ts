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
		update: vi.fn(),
		query: {
			invoices: { findFirst: vi.fn() },
			paymentSchedules: { findFirst: vi.fn() },
			receipts: { findFirst: vi.fn() },
			receivedAmounts: { findFirst: vi.fn() },
		},
	};

	return {
		chain,
		getHandler: () => handler,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedInvoiceForReceipt: vi.fn(),
		mockGetLockedScheduleForReceipt: vi.fn(),
		mockInsertReceiptWithGeneratedNumber: vi.fn(async () => ({
			id: "receipt_1",
		})),
		mockConvertSchedulePaymentIdempotently: vi.fn(),
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

vi.mock("../../../receipts/lib/receipt-transition-service", () => ({
	insertReceiptWithGeneratedNumber:
		mocks.mockInsertReceiptWithGeneratedNumber,
}));

vi.mock("../../../studio/lib/money", () => ({
	centsToMoney: vi.fn((cents: number) => (cents / 100).toFixed(2)),
	moneyToCents: vi.fn((money: string) => Math.round(Number(money) * 100)),
}));

vi.mock("../../lib/payment-idempotency", () => ({
	convertSchedulePaymentIdempotently:
		mocks.mockConvertSchedulePaymentIdempotently,
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

import { convertSchedulePaymentTransition } from "../../lib/schedule-payment-service";
import "./convert-schedule";

describe("schedule conversion invoice locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tx.query.invoices.findFirst.mockResolvedValue(null);
		mocks.mockConvertSchedulePaymentIdempotently.mockImplementation(
			async (tx, input) => {
				const result = await convertSchedulePaymentTransition(
					tx,
					input,
				);
				return {
					result: {
						data: {
							receivedId: result.receivedId,
							receiptId: result.receiptId,
							scheduleId: result.scheduleId,
						},
						message: "Payment schedule converted successfully",
					},
					replayed: false,
				};
			},
		);
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

	it("returns the stored response when an idempotent conversion replays", async () => {
		mocks.mockConvertSchedulePaymentIdempotently.mockResolvedValueOnce({
			result: {
				data: {
					receivedId: "payment_1",
					scheduleId: "schedule_1",
					receiptId: null,
				},
				message: "Stored conversion response",
			},
			replayed: true,
		});

		const response = await mocks.getHandler()?.({
			context: { organizationId: "org_1", user: { id: "user_1" } },
			input: {
				idempotencyKey: "payment-idempotency-key-1",
				scheduleId: "schedule_1",
				amount: "100.00",
				paymentMethod: "cash",
				receivedDate: "2026-01-01",
			},
		});

		expect(response).toEqual({
			data: {
				receivedId: "payment_1",
				receiptId: null,
				scheduleId: "schedule_1",
			},
			message: "Stored conversion response",
		});
	});

	it("rejects a cancelled linked invoice before creating the payment", async () => {
		mocks.tx.query.invoices.findFirst.mockResolvedValue({
			id: "invoice_1",
		});
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
					scheduleId: "schedule_1",
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

	it("propagates a changed invoice schedule relationship before payment", async () => {
		mocks.tx.query.invoices.findFirst
			.mockResolvedValueOnce({ id: "invoice_1" })
			.mockResolvedValueOnce(null);
		mocks.mockGetLockedInvoiceForReceipt.mockResolvedValue({
			id: "invoice_1",
			paymentScheduleId: "schedule_1",
		});

		await expect(
			mocks.getHandler()?.({
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
		).rejects.toThrow(
			"Invoice payment schedule relationship changed. Retry the request.",
		);
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});

	it("locks booking, invoice, then schedule on a successful conversion", async () => {
		const order: string[] = [];
		mocks.mockGetLockedBookingForReceipt.mockImplementation(async () => {
			order.push("booking");
			return { id: "booking_1", name: "Booking" };
		});
		mocks.tx.query.invoices.findFirst.mockResolvedValue({
			id: "invoice_1",
		});
		mocks.mockGetLockedInvoiceForReceipt.mockImplementation(async () => {
			order.push("invoice");
			return { id: "invoice_1", paymentScheduleId: "schedule_1" };
		});
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

	it("returns a deterministic conflict after a schedule was converted", async () => {
		mocks.mockGetLockedScheduleForReceipt.mockResolvedValue({
			id: "schedule_1",
			organizationId: "org_1",
			bookingId: "booking_1",
			name: "Final payment",
			amount: "100.00",
			paidAmount: "100.00",
			paidAt: new Date(),
			status: "completed",
		});

		await expect(
			mocks.getHandler()?.({
				context: { organizationId: "org_1", user: { id: "user_1" } },
				input: {
					scheduleId: "schedule_1",
					amount: "100.00",
					paymentMethod: "cash",
					receivedDate: "2026-01-01",
				},
			}),
		).rejects.toThrow("Payment schedule has already been converted");
		expect(mocks.tx.insert).not.toHaveBeenCalled();
	});
});
