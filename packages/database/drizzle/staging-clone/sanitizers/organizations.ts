import type { Client } from "pg";
import { executeSanitizer, fakeHash } from "./helpers";

export async function sanitizeOrganizations(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE organizations SET
			name = 'Studio ' || left(${fakeHash("organization")}, 10),
			slug = CASE WHEN slug IS NULL THEN NULL ELSE 'studio-' || left(${fakeHash("organization-slug")}, 20) END,
			logo = NULL,
			metadata = NULL,
			payments_customer_id = CASE WHEN payments_customer_id IS NULL THEN NULL ELSE 'cus_sanitized_' || ${fakeHash("organization-customer")} END`,
		`UPDATE teams SET name = 'Team ' || left(${fakeHash("team")}, 10)`,
		`UPDATE invitations SET email = 'invite+' || ${fakeHash("invitation-email")} || '@example.invalid'`,
		`UPDATE organization_roles SET
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized role description' END`,
		`UPDATE purchases SET
			customer_id = 'cus_sanitized_' || ${fakeHash("purchase-customer")},
			subscription_id = CASE WHEN subscription_id IS NULL THEN NULL ELSE 'sub_sanitized_' || ${fakeHash("purchase-subscription")} END,
			payment_id = CASE WHEN payment_id IS NULL THEN NULL ELSE 'pay_sanitized_' || ${fakeHash("purchase-payment")} END,
			product_id = 'product_sanitized_' || ${fakeHash("purchase-product")}`,
		`UPDATE webhook_events SET
			webhook_id = 'webhook_sanitized_' || ${fakeHash("webhook")},
			payload = '{}',
			error_message = NULL`,
	]);
}
