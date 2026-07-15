import type { Client } from "pg";
import { executeSanitizer, fakeHash, fakePhone } from "./helpers";

export async function sanitizeIntegrations(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE google_calendar_connections SET
			google_account_email = CASE WHEN google_account_email IS NULL THEN NULL ELSE 'calendar+' || ${fakeHash("calendar-email")} || '@example.invalid' END,
			access_token = NULL,
			refresh_token = NULL,
			scope = NULL,
			access_token_expires_at = NULL,
			disconnected_at = COALESCE(disconnected_at, now())`,
		`UPDATE shoot_calendar_events SET
			calendar_id = CASE WHEN calendar_id IS NULL THEN NULL ELSE 'calendar_' || ${fakeHash("shoot-calendar-id")} END,
			google_event_id = CASE WHEN google_event_id IS NULL THEN NULL ELSE 'event_' || ${fakeHash("shoot-google-event")} END,
			ical_uid = CASE WHEN ical_uid IS NULL THEN NULL ELSE ${fakeHash("shoot-ical-uid")} || '@example.invalid' END,
			recipient_email = CASE WHEN recipient_email IS NULL THEN NULL ELSE 'calendar-recipient+' || ${fakeHash("shoot-calendar-recipient")} || '@example.invalid' END,
			last_error = NULL`,
		`UPDATE calendar_sync_jobs SET
			status = 'failed',
			payload = CASE WHEN payload IS NULL THEN NULL ELSE '{}'::jsonb END,
			next_attempt_at = NULL,
			locked_at = NULL,
			last_error = 'Disabled in sanitized staging snapshot'
		WHERE status IN ('pending', 'processing')`,
		`UPDATE sms_outbox SET
			phone_number = ${fakePhone("sms-phone")},
			template_id = 'template_sanitized_' || left(${fakeHash("sms-template")}, 20),
			variables = CASE WHEN variables IS NULL THEN NULL ELSE '{}'::jsonb END,
			status = CASE WHEN status IN ('pending', 'processing') THEN 'failed'::sms_status ELSE status END,
			attempts = CASE WHEN status IN ('pending', 'processing') THEN max_attempts ELSE attempts END,
			next_attempt_at = NULL,
			error_message = CASE WHEN status IN ('pending', 'processing') THEN 'Disabled in sanitized staging snapshot' ELSE error_message END,
			provider_message_id = CASE WHEN provider_message_id IS NULL THEN NULL ELSE 'sms_sanitized_' || ${fakeHash("sms-provider-message")} END,
			locked_at = NULL,
			locked_by = NULL,
			processing_started_at = NULL,
			error_code = NULL,
			is_permanent_failure = CASE WHEN status IN ('pending', 'processing') THEN true ELSE is_permanent_failure END`,
	]);
}
