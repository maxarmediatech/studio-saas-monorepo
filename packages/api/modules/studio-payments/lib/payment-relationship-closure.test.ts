import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getLockedInvoice: vi.fn(),
	getLockedSchedule: vi.fn(),
}));

vi.mock("../../receipts/lib/locked-invoice-for-receipt", () => ({
	getLockedInvoiceForReceipt: mocks.getLockedInvoice,
	getLockedScheduleForReceipt: mocks.getLockedSchedule,
}));

import { resolveLockedPaymentRelationships } from "./payment-relationship-closure";

function createTx(...linkedInvoiceIds: Array<string | null>) {
	const findFirst = vi.fn();
	for (const id of linkedInvoiceIds) {
		findFirst.mockResolvedValueOnce(id ? { id } : null);
	}
	return {
		tx: { query: { invoices: { findFirst } } },
		findFirst,
	};
}

const baseInput = {
	organizationId: "org_1",
	bookingId: "booking_1",
};

describe("payment invoice and schedule closure", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("derives the schedule from an invoice-only payment", async () => {
		const { tx } = createTx("invoice_1");
		mocks.getLockedInvoice.mockResolvedValue({
			id: "invoice_1",
			paymentScheduleId: "schedule_1",
		});
		mocks.getLockedSchedule.mockResolvedValue({ id: "schedule_1" });

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				invoiceId: "invoice_1",
			}),
		).resolves.toMatchObject({
			invoiceId: "invoice_1",
			paymentScheduleId: "schedule_1",
		});
		expect(mocks.getLockedInvoice.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.getLockedSchedule.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("derives the invoice from a schedule-only payment", async () => {
		const { tx } = createTx("invoice_1", "invoice_1");
		mocks.getLockedInvoice.mockResolvedValue({
			id: "invoice_1",
			paymentScheduleId: "schedule_1",
		});
		mocks.getLockedSchedule.mockResolvedValue({ id: "schedule_1" });

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				paymentScheduleId: "schedule_1",
			}),
		).resolves.toMatchObject({
			invoiceId: "invoice_1",
			paymentScheduleId: "schedule_1",
		});
		expect(mocks.getLockedInvoice.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.getLockedSchedule.mock.invocationCallOrder[0] ?? 0,
		);
	});

	it("rejects an explicit invoice and schedule mismatch before effects", async () => {
		const { tx } = createTx("invoice_other");

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				invoiceId: "invoice_1",
				paymentScheduleId: "schedule_1",
			}),
		).rejects.toThrow(
			"Invoice does not belong to the selected payment schedule",
		);
		expect(mocks.getLockedInvoice).not.toHaveBeenCalled();
		expect(mocks.getLockedSchedule).not.toHaveBeenCalled();
	});

	it("keeps an unlinked invoice valid without inventing a schedule", async () => {
		const { tx, findFirst } = createTx();
		mocks.getLockedInvoice.mockResolvedValue({
			id: "invoice_1",
			paymentScheduleId: null,
		});

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				invoiceId: "invoice_1",
			}),
		).resolves.toMatchObject({
			invoiceId: "invoice_1",
			paymentScheduleId: null,
		});
		expect(findFirst).not.toHaveBeenCalled();
		expect(mocks.getLockedSchedule).not.toHaveBeenCalled();
	});

	it("rejects a relationship that changes while the schedule is locking", async () => {
		const { tx } = createTx(null, "invoice_1");
		mocks.getLockedSchedule.mockResolvedValue({ id: "schedule_1" });

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				paymentScheduleId: "schedule_1",
			}),
		).rejects.toThrow(
			"Invoice payment schedule relationship changed. Retry the request.",
		);
	});

	it("rejects cross-organization or cross-booking invoice IDs", async () => {
		const { tx } = createTx();
		mocks.getLockedInvoice.mockResolvedValue(null);

		await expect(
			resolveLockedPaymentRelationships(tx as never, {
				...baseInput,
				invoiceId: "foreign_invoice",
			}),
		).rejects.toThrow(
			"Invoice not found or does not belong to this booking",
		);
	});
});
