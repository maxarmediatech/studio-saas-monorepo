import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	isNull: vi.fn((column: unknown) => ({ column })),
	sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
		strings,
		values,
	})),
}));

vi.mock("@repo/database", () => ({
	and: mocks.and,
	bookings: {
		deletedAt: "bookingDeletedAt",
		id: "bookingId",
		organizationId: "bookingOrganizationId",
	},
	db: {},
	eq: mocks.eq,
	invoices: {
		bookingId: "bookingId",
		deletedAt: "deletedAt",
		id: "id",
		organizationId: "organizationId",
		paymentScheduleId: "paymentScheduleId",
	},
	isNull: mocks.isNull,
	receipts: {
		id: "receiptId",
		organizationId: "receiptOrganizationId",
		receivedAmountId: "receivedAmountId",
	},
	sql: mocks.sql,
}));

import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
	getLockedReceiptHistoryForPayment,
	getLockedScheduleInvoiceForReceipt,
} from "./locked-invoice-for-receipt";

describe("locked invoice receipt context", () => {
	it("locks the booking before dependent financial rows", async () => {
		const booking = { id: "booking_1", name: "Booking" };
		const tx = {
			execute: vi.fn(),
			query: {
				bookings: { findFirst: vi.fn().mockResolvedValue(booking) },
			},
		};

		await expect(
			getLockedBookingForReceipt(tx as never, {
				organizationId: "org_1",
				bookingId: "booking_1",
			}),
		).resolves.toBe(booking);
		expect(tx.execute).toHaveBeenCalledOnce();
		expect(mocks.sql.mock.calls[0]?.[0]?.join("")).toContain("FOR UPDATE");
	});

	it("locks and returns the current active invoice", async () => {
		const invoice = {
			id: "invoice_1",
			status: "sent",
			paymentScheduleId: "schedule_1",
		};
		const tx = {
			execute: vi.fn(),
			query: {
				invoices: { findFirst: vi.fn().mockResolvedValue(invoice) },
			},
		};

		await expect(
			getLockedInvoiceForReceipt(tx as never, {
				organizationId: "org_1",
				bookingId: "booking_1",
				invoiceId: "invoice_1",
			}),
		).resolves.toBe(invoice);
		expect(tx.execute).toHaveBeenCalledOnce();
		expect(mocks.sql.mock.calls[0]?.[0]?.join("")).toContain("FOR UPDATE");
	});

	it("rejects a cancelled invoice after acquiring its row lock", async () => {
		const tx = {
			execute: vi.fn(),
			query: {
				invoices: {
					findFirst: vi.fn().mockResolvedValue({
						id: "invoice_1",
						status: "cancelled",
					}),
				},
			},
		};

		await expect(
			getLockedInvoiceForReceipt(tx as never, {
				organizationId: "org_1",
				bookingId: "booking_1",
				invoiceId: "invoice_1",
			}),
		).rejects.toThrow("Cannot issue a receipt for a cancelled invoice");
		expect(tx.execute).toHaveBeenCalledOnce();
	});

	it.each([
		"schedule_2",
		null,
	])("rejects when the locked invoice schedule changed to %s", async (lockedPaymentScheduleId) => {
		const findFirst = vi
			.fn()
			.mockResolvedValueOnce({ id: "invoice_1" })
			.mockResolvedValueOnce({
				id: "invoice_1",
				status: "sent",
				paymentScheduleId: lockedPaymentScheduleId,
			});
		const tx = {
			execute: vi.fn(),
			query: { invoices: { findFirst } },
		};

		await expect(
			getLockedScheduleInvoiceForReceipt(tx as never, {
				organizationId: "org_1",
				bookingId: "booking_1",
				paymentScheduleId: "schedule_1",
			}),
		).rejects.toThrow(
			"Invoice payment schedule relationship changed. Retry the request.",
		);
		expect(findFirst).toHaveBeenCalledTimes(2);
		expect(tx.execute).toHaveBeenCalledOnce();
	});

	it("resolves a schedule invoice through the same locked validation", async () => {
		const invoice = {
			id: "invoice_1",
			status: "sent",
			paymentScheduleId: "schedule_1",
		};
		const findFirst = vi
			.fn()
			.mockResolvedValueOnce({ id: "invoice_1" })
			.mockResolvedValueOnce(invoice);
		const tx = {
			execute: vi.fn(),
			query: { invoices: { findFirst } },
		};

		await expect(
			getLockedScheduleInvoiceForReceipt(tx as never, {
				organizationId: "org_1",
				bookingId: "booking_1",
				paymentScheduleId: "schedule_1",
			}),
		).resolves.toBe(invoice);
		expect(findFirst).toHaveBeenCalledTimes(2);
		expect(tx.execute).toHaveBeenCalledOnce();
	});

	it("locks active and voided receipt history for a received payment", async () => {
		const history = [
			{ id: "receipt_1", deletedAt: null },
			{ id: "receipt_2", deletedAt: new Date() },
		];
		const tx = {
			execute: vi.fn(),
			query: {
				receipts: { findMany: vi.fn().mockResolvedValue(history) },
			},
		};

		await expect(
			getLockedReceiptHistoryForPayment(tx as never, {
				organizationId: "org_1",
				receivedAmountId: "payment_1",
			}),
		).resolves.toBe(history);
		expect(tx.execute).toHaveBeenCalledOnce();
		const latestSqlCall =
			mocks.sql.mock.calls[mocks.sql.mock.calls.length - 1];
		expect(latestSqlCall?.[0]?.join("")).toContain("FOR UPDATE");
	});
});
