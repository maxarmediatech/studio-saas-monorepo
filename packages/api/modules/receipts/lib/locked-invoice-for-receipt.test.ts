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
	sql: mocks.sql,
}));

import {
	getLockedBookingForReceipt,
	getLockedInvoiceForReceipt,
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
		const invoice = { id: "invoice_1", status: "sent" };
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

	it("resolves a schedule invoice through the same locked validation", async () => {
		const invoice = { id: "invoice_1", status: "sent" };
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
});
