import { ORPCError } from "@orpc/server";
import { and, type db, eq, receipts } from "@repo/database";

export const PAYMENT_FINANCIAL_DETAILS_LOCKED_MESSAGE =
	"This payment's amount, method, and date are locked because it is already applied to financial records.";

export const PAYMENT_DELETE_LOCKED_MESSAGE =
	"This payment cannot be deleted because it is already applied to financial records.";

export type PaymentFinancialProtectionReason =
	| "invoice"
	| "receipt"
	| "schedule";

export interface PaymentFinancialProtection {
	canEditFinancialDetails: boolean;
	canDelete: boolean;
	reasons: PaymentFinancialProtectionReason[];
}

export type PaymentFinancialProtectionExecutor = Pick<typeof db, "query">;

interface BuildPaymentFinancialProtectionInput {
	invoiceId: string | null;
	paymentScheduleId: string | null;
	receiptId: string | null;
}

export function buildPaymentFinancialProtection({
	invoiceId,
	paymentScheduleId,
	receiptId,
}: BuildPaymentFinancialProtectionInput): PaymentFinancialProtection {
	const reasons: PaymentFinancialProtectionReason[] = [];

	if (invoiceId) {
		reasons.push("invoice");
	}
	if (receiptId) {
		reasons.push("receipt");
	}
	if (paymentScheduleId) {
		reasons.push("schedule");
	}

	const isProtected = reasons.length > 0;

	return {
		canEditFinancialDetails: !isProtected,
		canDelete: !isProtected,
		reasons,
	};
}

export async function getPaymentFinancialProtection(
	executor: PaymentFinancialProtectionExecutor,
	{
		organizationId,
		receivedAmountId,
		invoiceId,
		paymentScheduleId,
	}: {
		organizationId: string;
		receivedAmountId: string;
		invoiceId: string | null;
		paymentScheduleId: string | null;
	},
): Promise<PaymentFinancialProtection> {
	const receipt = await executor.query.receipts.findFirst({
		where: and(
			eq(receipts.organizationId, organizationId),
			eq(receipts.receivedAmountId, receivedAmountId),
		),
		columns: { id: true },
	});

	return buildPaymentFinancialProtection({
		invoiceId,
		paymentScheduleId,
		receiptId: receipt?.id ?? null,
	});
}

export function assertPaymentFinancialDetailsEditable(
	protection: PaymentFinancialProtection,
): void {
	if (!protection.canEditFinancialDetails) {
		throw new ORPCError("CONFLICT", {
			message: PAYMENT_FINANCIAL_DETAILS_LOCKED_MESSAGE,
		});
	}
}

export function assertPaymentDeletable(
	protection: PaymentFinancialProtection,
): void {
	if (!protection.canDelete) {
		throw new ORPCError("CONFLICT", {
			message: PAYMENT_DELETE_LOCKED_MESSAGE,
		});
	}
}
