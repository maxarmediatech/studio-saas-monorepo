import { describe, expect, it } from "vitest";
import { buildCreatePaymentRequest } from "./payment-create-request";

const formValues = {
	bookingId: "booking-1",
	invoiceId: "invoice-1",
	amount: "100",
	paymentMethod: "bank_transfer" as const,
	receivedDate: "2026-07-10",
	transactionReference: "bank-ref",
	notes: "Client payment",
};

describe("buildCreatePaymentRequest", () => {
	it("passes the selected invoice through the mutation request", () => {
		expect(buildCreatePaymentRequest(formValues)).toMatchObject({
			bookingId: "booking-1",
			amount: "100.00",
			invoiceId: "invoice-1",
		});
	});

	it("changes the request payload when the selected invoice changes", () => {
		const invoiceRequest = buildCreatePaymentRequest(formValues);
		const standaloneRequest = buildCreatePaymentRequest({
			...formValues,
			invoiceId: "",
		});

		expect(invoiceRequest).not.toEqual(standaloneRequest);
		expect(standaloneRequest.invoiceId).toBeUndefined();
	});
});
