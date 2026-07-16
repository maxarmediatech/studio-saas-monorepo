import { ORPCError } from "@orpc/server";
import { and, eq, invoices, isNull } from "@repo/database";
import {
	getLockedInvoiceForReceipt,
	getLockedScheduleForReceipt,
} from "../../receipts/lib/locked-invoice-for-receipt";
import type { TransactionClient } from "../../studio/lib/transactions";

const RELATIONSHIP_CHANGED_MESSAGE =
	"Invoice payment schedule relationship changed. Retry the request.";

async function findLinkedInvoiceId(
	tx: TransactionClient,
	input: {
		organizationId: string;
		bookingId: string;
		paymentScheduleId: string;
	},
): Promise<string | null> {
	const linkedInvoice = await tx.query.invoices.findFirst({
		where: and(
			eq(invoices.organizationId, input.organizationId),
			eq(invoices.bookingId, input.bookingId),
			eq(invoices.paymentScheduleId, input.paymentScheduleId),
			isNull(invoices.deletedAt),
		),
		columns: { id: true },
	});
	return linkedInvoice?.id ?? null;
}

export async function resolveLockedPaymentRelationships(
	tx: TransactionClient,
	input: {
		organizationId: string;
		bookingId: string;
		invoiceId?: string;
		paymentScheduleId?: string;
	},
) {
	const plannedScheduleInvoiceId = input.paymentScheduleId
		? await findLinkedInvoiceId(tx, {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				paymentScheduleId: input.paymentScheduleId,
			})
		: null;

	if (
		input.invoiceId &&
		plannedScheduleInvoiceId &&
		input.invoiceId !== plannedScheduleInvoiceId
	) {
		throw new ORPCError("CONFLICT", {
			message: "Invoice does not belong to the selected payment schedule",
		});
	}

	const effectiveInvoiceId = input.invoiceId ?? plannedScheduleInvoiceId;
	const invoice = effectiveInvoiceId
		? await getLockedInvoiceForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				invoiceId: effectiveInvoiceId,
			})
		: null;

	if (input.invoiceId && !invoice) {
		throw new ORPCError("NOT_FOUND", {
			message: "Invoice not found or does not belong to this booking",
		});
	}
	if (plannedScheduleInvoiceId && !invoice) {
		throw new ORPCError("CONFLICT", {
			message: RELATIONSHIP_CHANGED_MESSAGE,
		});
	}
	if (
		input.paymentScheduleId &&
		invoice &&
		invoice.paymentScheduleId !== input.paymentScheduleId
	) {
		throw new ORPCError("CONFLICT", {
			message: "Invoice does not belong to the selected payment schedule",
		});
	}

	const effectivePaymentScheduleId =
		input.paymentScheduleId ?? invoice?.paymentScheduleId ?? null;
	const schedule = effectivePaymentScheduleId
		? await getLockedScheduleForReceipt(tx, {
				organizationId: input.organizationId,
				bookingId: input.bookingId,
				paymentScheduleId: effectivePaymentScheduleId,
			})
		: null;

	if (input.paymentScheduleId && !schedule) {
		throw new ORPCError("NOT_FOUND", {
			message: "Payment schedule not found",
		});
	}
	if (invoice?.paymentScheduleId && !schedule) {
		throw new ORPCError("CONFLICT", {
			message: "The invoice payment schedule is no longer available",
		});
	}

	if (schedule) {
		const lockedScheduleInvoiceId = await findLinkedInvoiceId(tx, {
			organizationId: input.organizationId,
			bookingId: input.bookingId,
			paymentScheduleId: schedule.id,
		});
		if (lockedScheduleInvoiceId !== (invoice?.id ?? null)) {
			throw new ORPCError("CONFLICT", {
				message: RELATIONSHIP_CHANGED_MESSAGE,
			});
		}
	}

	return {
		invoice,
		schedule,
		invoiceId: invoice?.id ?? null,
		paymentScheduleId: schedule?.id ?? null,
	};
}
