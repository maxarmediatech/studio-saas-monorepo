import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const handlers: Array<
		(options: {
			input: Record<string, unknown>;
			context: {
				organizationId: string;
				user: { id: string };
			};
		}) => Promise<unknown>
	> = [];
	const chain = {
		route: vi.fn(() => chain),
		input: vi.fn(() => chain),
		output: vi.fn(() => chain),
		handler: vi.fn((handler) => {
			handlers.push(handler);
			return chain;
		}),
	};
	const tx = {
		execute: vi.fn(),
		query: {
			bookings: { findFirst: vi.fn() },
			invoices: { findFirst: vi.fn() },
			receipts: { findFirst: vi.fn(), findMany: vi.fn() },
			receivedAmounts: { findFirst: vi.fn() },
		},
	};

	return {
		chain,
		handlers,
		mockGetLockedBookingForReceipt: vi.fn(),
		mockGetLockedReceiptHistoryForPayment: vi.fn(),
		mockGetLockedReceivedPayment: vi.fn(),
		mockGetLockedInvoiceForReceipt: vi.fn(),
		mockGetLockedScheduleForReceipt: vi.fn(),
		mockRequirePermission: vi.fn(),
		mockTransaction: vi.fn(async (callback) => callback(tx)),
		tx,
	};
});

vi.mock("../../../orpc/procedures", () => ({
	studioProtectedProcedure: mocks.chain,
}));

vi.mock("../../studio/lib/permissions", () => ({
	requirePermission: mocks.mockRequirePermission,
}));

vi.mock("../../activities/lib", () => ({
	formatAmount: vi.fn((amount: string) => amount),
	safeTrackActivity: vi.fn(),
}));

vi.mock("../../studio-payments/lib/received-payment-lock", () => ({
	getLockedReceivedPayment: mocks.mockGetLockedReceivedPayment,
}));

vi.mock("../lib/locked-invoice-for-receipt", () => ({
	getLockedBookingForReceipt: mocks.mockGetLockedBookingForReceipt,
	getLockedInvoiceForReceipt: mocks.mockGetLockedInvoiceForReceipt,
	getLockedReceiptHistoryForPayment:
		mocks.mockGetLockedReceiptHistoryForPayment,
	getLockedScheduleForReceipt: mocks.mockGetLockedScheduleForReceipt,
}));

vi.mock("../lib/receipt-helpers", () => ({
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
		transaction: mocks.mockTransaction,
	},
	desc: vi.fn(),
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	invoices: {
		bookingId: "invoiceBookingId",
		deletedAt: "deletedAt",
		id: "invoiceId",
		organizationId: "invoiceOrganizationId",
	},
	isNull: vi.fn((column: unknown) => ({ column })),
	ne: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	receipts: {
		createdAt: "createdAt",
		deletedAt: "deletedAt",
		organizationId: "organizationId",
		receivedAmountId: "receivedAmountId",
	},
	receivedAmounts: {
		bookingId: "paymentBookingId",
		deletedAt: "paymentDeletedAt",
		id: "paymentId",
		invoiceId: "paymentInvoiceId",
		organizationId: "paymentOrganizationId",
	},
	sql: vi.fn(),
}));

import "./create-from-payment";
import "./generate-from-received";

const context = { organizationId: "org_1", user: { id: "user_1" } };
const received = {
	id: "payment_1",
	bookingId: "booking_1",
	invoiceId: "invoice_1",
	paymentScheduleId: null,
	amount: "100.00",
	paymentMethod: "cash",
	receivedDate: "2026-01-01",
	notes: null,
};

describe("receipt producers received-payment locking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.tx.query.bookings.findFirst.mockResolvedValue({
			id: "booking_1",
			name: "Booking",
		});
		mocks.tx.query.invoices.findFirst.mockResolvedValue({
			id: "invoice_1",
			invoiceNumber: "INV-1",
			paymentScheduleId: null,
		});
		mocks.tx.query.receivedAmounts.findFirst.mockResolvedValue({
			bookingId: "booking_1",
			invoiceId: "invoice_1",
			paymentScheduleId: null,
		});
		mocks.mockGetLockedBookingForReceipt.mockResolvedValue({
			id: "booking_1",
			name: "Booking",
		});
		mocks.mockGetLockedInvoiceForReceipt.mockResolvedValue({
			id: "invoice_1",
			invoiceNumber: "INV-1",
			paymentScheduleId: null,
			status: "sent",
		});
		mocks.mockGetLockedReceiptHistoryForPayment.mockResolvedValue([]);
	});

	it("locks and rechecks before create-from-payment decides an existing receipt wins", async () => {
		const events: string[] = [];
		mocks.mockGetLockedReceivedPayment.mockImplementation(async () => {
			events.push("lock-and-read");
			return received;
		});
		mocks.mockGetLockedReceiptHistoryForPayment.mockImplementation(
			async () => {
				events.push("receipt-check");
				return [
					{
						id: "receipt_1",
						receiptNumber: "RCPT-1",
						deletedAt: null,
					},
				];
			},
		);
		await expect(
			mocks.handlers[0]({
				context,
				input: {
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					receivedAmountId: "payment_1",
				},
			}),
		).resolves.toEqual({
			data: { id: "receipt_1" },
			message: "Receipt already exists",
		});

		expect(mocks.mockTransaction).toHaveBeenCalledOnce();
		expect(events).toEqual(["lock-and-read", "receipt-check"]);
	});

	it("rejects a received payment from another booking before issuing a receipt", async () => {
		mocks.mockGetLockedReceivedPayment.mockResolvedValue({
			...received,
			bookingId: "booking_2",
		});

		await expect(
			mocks.handlers[0]({
				context,
				input: {
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					receivedAmountId: "payment_1",
				},
			}),
		).rejects.toThrow(
			"Received payment does not match the supplied booking or invoice",
		);

		expect(mocks.tx.execute).not.toHaveBeenCalled();
		expect(
			mocks.mockGetLockedReceiptHistoryForPayment,
		).not.toHaveBeenCalled();
	});

	it("rejects an invoice deleted before the transactional recheck", async () => {
		mocks.mockGetLockedReceivedPayment.mockResolvedValue(received);
		mocks.mockGetLockedInvoiceForReceipt.mockResolvedValue(null);

		await expect(
			mocks.handlers[0]({
				context,
				input: {
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					receivedAmountId: "payment_1",
				},
			}),
		).rejects.toThrow(
			"Invoice not found or does not belong to this booking",
		);

		expect(mocks.tx.execute).not.toHaveBeenCalled();
		expect(
			mocks.mockGetLockedReceiptHistoryForPayment,
		).not.toHaveBeenCalled();
	});

	it("does not reissue a receipt after the linked invoice was cancelled", async () => {
		mocks.mockGetLockedReceivedPayment.mockResolvedValue(received);
		mocks.mockGetLockedInvoiceForReceipt.mockRejectedValue(
			new Error("Cannot issue a receipt for a cancelled invoice"),
		);

		await expect(
			mocks.handlers[1]({
				context,
				input: { receivedAmountId: "payment_1" },
			}),
		).rejects.toThrow("Cannot issue a receipt for a cancelled invoice");

		expect(
			mocks.mockGetLockedReceiptHistoryForPayment,
		).not.toHaveBeenCalled();
	});

	it("locks and rechecks before generate-from-received decides an existing receipt wins", async () => {
		const events: string[] = [];
		mocks.mockGetLockedReceivedPayment.mockImplementation(async () => {
			events.push("lock-and-read");
			return received;
		});
		mocks.mockGetLockedReceiptHistoryForPayment.mockImplementation(
			async () => {
				events.push("receipt-check");
				return [
					{
						id: "receipt_1",
						receiptNumber: "RCPT-1",
						deletedAt: null,
					},
				];
			},
		);

		await expect(
			mocks.handlers[1]({
				context,
				input: { receivedAmountId: "payment_1" },
			}),
		).resolves.toEqual({
			data: { id: "receipt_1" },
			message: "Receipt already exists",
		});

		expect(mocks.mockTransaction).toHaveBeenCalledOnce();
		expect(events).toEqual(["lock-and-read", "receipt-check"]);
	});

	it("locks booking, invoice, schedule, payment, then receipt history", async () => {
		const events: string[] = [];
		mocks.tx.query.receivedAmounts.findFirst.mockResolvedValue({
			bookingId: "booking_1",
			invoiceId: "invoice_1",
			paymentScheduleId: "schedule_1",
		});
		mocks.mockGetLockedBookingForReceipt.mockImplementation(async () => {
			events.push("booking");
			return { id: "booking_1", name: "Booking" };
		});
		mocks.mockGetLockedInvoiceForReceipt.mockImplementation(async () => {
			events.push("invoice");
			return {
				id: "invoice_1",
				invoiceNumber: "INV-1",
				paymentScheduleId: "schedule_1",
				status: "sent",
			};
		});
		mocks.mockGetLockedScheduleForReceipt.mockImplementation(async () => {
			events.push("schedule");
			return { id: "schedule_1" };
		});
		mocks.mockGetLockedReceivedPayment.mockImplementation(async () => {
			events.push("payment");
			return { ...received, paymentScheduleId: "schedule_1" };
		});
		mocks.mockGetLockedReceiptHistoryForPayment.mockImplementation(
			async () => {
				events.push("receipt");
				return [
					{
						id: "receipt_1",
						receiptNumber: "RCPT-1",
						deletedAt: null,
					},
				];
			},
		);

		await expect(
			mocks.handlers[0]({
				context,
				input: {
					bookingId: "booking_1",
					invoiceId: "invoice_1",
					receivedAmountId: "payment_1",
				},
			}),
		).resolves.toMatchObject({ data: { id: "receipt_1" } });
		expect(events).toEqual([
			"booking",
			"invoice",
			"schedule",
			"payment",
			"receipt",
		]);
	});

	it("treats a voided receipt as terminal for ordinary reissuance", async () => {
		mocks.mockGetLockedReceivedPayment.mockResolvedValue(received);
		mocks.mockGetLockedReceiptHistoryForPayment.mockResolvedValue([
			{
				id: "voided_receipt_1",
				receiptNumber: "RCPT-VOID",
				deletedAt: new Date(),
			},
		]);

		await expect(
			mocks.handlers[1]({
				context,
				input: { receivedAmountId: "payment_1" },
			}),
		).rejects.toThrow(
			"A receipt for this payment was voided and cannot be reissued",
		);
	});
});
