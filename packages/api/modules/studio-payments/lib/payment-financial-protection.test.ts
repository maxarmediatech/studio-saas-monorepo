import { ORPCError } from "@orpc/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/database", () => ({
	and: vi.fn((...conditions: unknown[]) => conditions),
	db: {
		query: {
			receipts: {
				findFirst: vi.fn(),
			},
		},
	},
	eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
	receipts: {
		organizationId: "organizationId",
		receivedAmountId: "receivedAmountId",
	},
}));

import {
	assertPaymentDeletable,
	assertPaymentFinancialDetailsEditable,
	buildPaymentFinancialProtection,
	getPaymentFinancialProtection,
	PAYMENT_DELETE_LOCKED_MESSAGE,
	PAYMENT_FINANCIAL_DETAILS_LOCKED_MESSAGE,
} from "./payment-financial-protection";

describe("payment financial protection", () => {
	it("allows changing and deleting an unapplied standalone payment", () => {
		const protection = buildPaymentFinancialProtection({
			invoiceId: null,
			paymentScheduleId: null,
			receiptId: null,
		});

		expect(protection).toEqual({
			canEditFinancialDetails: true,
			canDelete: true,
			reasons: [],
		});
		expect(() =>
			assertPaymentFinancialDetailsEditable(protection),
		).not.toThrow();
		expect(() => assertPaymentDeletable(protection)).not.toThrow();
	});

	it.each([
		[
			"invoice",
			{ invoiceId: "inv_1", paymentScheduleId: null, receiptId: null },
		],
		[
			"receipt",
			{ invoiceId: null, paymentScheduleId: null, receiptId: "rec_1" },
		],
		[
			"schedule",
			{ invoiceId: null, paymentScheduleId: "sch_1", receiptId: null },
		],
	] as const)("protects a payment linked to a %s", (reason, links) => {
		const protection = buildPaymentFinancialProtection(links);

		expect(protection).toEqual({
			canEditFinancialDetails: false,
			canDelete: false,
			reasons: [reason],
		});
	});

	it("reports every financial link that protects the payment", () => {
		expect(
			buildPaymentFinancialProtection({
				invoiceId: "inv_1",
				paymentScheduleId: "sch_1",
				receiptId: "rec_1",
			}),
		).toEqual({
			canEditFinancialDetails: false,
			canDelete: false,
			reasons: ["invoice", "receipt", "schedule"],
		});
	});

	it("checks receipts through the supplied transaction executor", async () => {
		const findFirst = vi.fn().mockResolvedValue({ id: "receipt_1" });

		await expect(
			getPaymentFinancialProtection(
				{ query: { receipts: { findFirst } } } as never,
				{
					organizationId: "org_1",
					receivedAmountId: "payment_1",
					invoiceId: null,
					paymentScheduleId: null,
				},
			),
		).resolves.toEqual({
			canEditFinancialDetails: false,
			canDelete: false,
			reasons: ["receipt"],
		});

		expect(findFirst).toHaveBeenCalledOnce();
	});

	it("keeps a payment protected when its receipt was voided", async () => {
		const findFirst = vi.fn().mockResolvedValue({
			id: "receipt_1",
			deletedAt: new Date(),
		});

		await expect(
			getPaymentFinancialProtection(
				{ query: { receipts: { findFirst } } } as never,
				{
					organizationId: "org_1",
					receivedAmountId: "payment_1",
					invoiceId: null,
					paymentScheduleId: null,
				},
			),
		).resolves.toMatchObject({
			canEditFinancialDetails: false,
			canDelete: false,
			reasons: ["receipt"],
		});
	});

	it("rejects financial detail changes with a stable conflict message", () => {
		const protection = buildPaymentFinancialProtection({
			invoiceId: "inv_1",
			paymentScheduleId: null,
			receiptId: "rec_1",
		});

		expect(() =>
			assertPaymentFinancialDetailsEditable(protection),
		).toThrowError(PAYMENT_FINANCIAL_DETAILS_LOCKED_MESSAGE);

		try {
			assertPaymentFinancialDetailsEditable(protection);
		} catch (error) {
			expect(error).toBeInstanceOf(ORPCError);
			expect((error as ORPCError<string, unknown>).code).toBe("CONFLICT");
		}
	});

	it("rejects deletion with a stable conflict message", () => {
		const protection = buildPaymentFinancialProtection({
			invoiceId: null,
			paymentScheduleId: "sch_1",
			receiptId: null,
		});

		expect(() => assertPaymentDeletable(protection)).toThrowError(
			PAYMENT_DELETE_LOCKED_MESSAGE,
		);
	});
});
