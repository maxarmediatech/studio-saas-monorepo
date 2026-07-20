import type { Client } from "pg";
import { executeSanitizer, fakeHash } from "./helpers";

export async function sanitizeFinancial(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE bookings SET reference_number = 'BKG-S-' || upper(left(${fakeHash("booking-reference")}, 12))`,
		`UPDATE expenses SET
			description = 'Sanitized expense ' || left(${fakeHash("expense")}, 10),
			transaction_reference = CASE WHEN transaction_reference IS NULL THEN NULL ELSE 'txn_sanitized_' || ${fakeHash("expense-transaction")} END,
			vendor = CASE WHEN vendor IS NULL THEN NULL ELSE 'Vendor ' || left(${fakeHash("expense-vendor")}, 10) END,
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized expense notes' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE received_amounts SET
			transaction_reference = CASE WHEN transaction_reference IS NULL THEN NULL ELSE 'txn_sanitized_' || ${fakeHash("received-transaction")} END,
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized payment notes' END,
			proof_attachment = CASE WHEN proof_attachment IS NULL THEN NULL ELSE '{}'::jsonb END,
			reversal_reason = CASE WHEN reversal_reason IS NULL THEN NULL ELSE 'Sanitized reversal reason' END`,
		`UPDATE payment_idempotency_records SET
			idempotency_key = left(${fakeHash("payment-idempotency")}, 32),
			request_fingerprint = ${fakeHash("payment-request-fingerprint")},
			result_payload = CASE WHEN result_payload IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE document_sequences SET
			scope_key = ${fakeHash("document-sequence-scope")}`,
		`UPDATE payment_schedules SET
			name = 'Payment ' || left(${fakeHash("payment-schedule")}, 10),
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized payment schedule notes' END`,
		`UPDATE invoices SET
			invoice_number = 'INV-S-' || upper(left(${fakeHash("invoice-number")}, 12)),
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized invoice notes' END,
			terms = CASE WHEN terms IS NULL THEN NULL ELSE 'Sanitized payment terms' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE invoice_line_items SET
			description = 'Sanitized line item ' || left(${fakeHash("invoice-line")}, 10)`,
		`UPDATE receipts SET
			receipt_number = 'RCP-S-' || upper(left(${fakeHash("receipt-number")}, 12)),
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized receipt notes' END`,
	]);
}
