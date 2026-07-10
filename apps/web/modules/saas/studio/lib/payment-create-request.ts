import type { CreateReceivedInput } from "@repo/api/modules/studio/schemas/payment";
import type { PaymentFormValues } from "../components/payments/PaymentForm";

export type PaymentCreateRequest = Omit<CreateReceivedInput, "idempotencyKey">;

export function buildCreatePaymentRequest(
	data: PaymentFormValues,
): PaymentCreateRequest {
	return {
		bookingId: data.bookingId,
		amount: Number(data.amount).toFixed(2),
		paymentMethod: data.paymentMethod,
		receivedDate: data.receivedDate,
		invoiceId: data.invoiceId || undefined,
		transactionReference: data.transactionReference || undefined,
		notes: data.notes || undefined,
	};
}
