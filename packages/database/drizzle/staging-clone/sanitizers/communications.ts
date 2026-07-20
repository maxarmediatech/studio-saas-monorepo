import type { Client } from "pg";
import { executeSanitizer, fakeHash, fakePhone } from "./helpers";

export async function sanitizeCommunications(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE channels SET
			name = 'Channel ' || left(${fakeHash("channel")}, 10),
			slug = 'channel-' || left(${fakeHash("channel-slug")}, 20),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized channel description' END`,
		`UPDATE discussions SET
			title = 'Discussion ' || left(${fakeHash("discussion")}, 10),
			content = 'Sanitized discussion content',
			content_json = NULL,
			content_text = CASE WHEN content_text IS NULL THEN NULL ELSE 'Sanitized discussion content' END,
			resolution = CASE WHEN resolution IS NULL THEN NULL ELSE 'Sanitized resolution' END`,
		`UPDATE discussion_messages SET
			content = 'Sanitized discussion message',
			content_json = NULL,
			content_text = CASE WHEN content_text IS NULL THEN NULL ELSE 'Sanitized discussion message' END`,
		`UPDATE checkin_types SET
			name = 'Check-in ' || left(${fakeHash("checkin-type")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized check-in description' END`,
		`UPDATE checkins SET
			content = 'Sanitized check-in content',
			content_json = NULL,
			content_text = CASE WHEN content_text IS NULL THEN NULL ELSE 'Sanitized check-in content' END`,
		`UPDATE checkin_comments SET
			content = 'Sanitized check-in comment',
			content_json = NULL,
			content_text = CASE WHEN content_text IS NULL THEN NULL ELSE 'Sanitized check-in comment' END`,
		`UPDATE wa_accounts SET
			name = 'WhatsApp account ' || left(${fakeHash("wa-account")}, 10),
			phone_number = CASE WHEN phone_number IS NULL THEN NULL ELSE ${fakePhone("wa-account-phone")} END,
			display_phone_number = CASE WHEN display_phone_number IS NULL THEN NULL ELSE ${fakePhone("wa-account-display-phone")} END,
			connection_status = 'disconnected',
			session_key = NULL,
			session_data = NULL,
			qr_code = NULL,
			qr_expires_at = NULL,
			waba_id = CASE WHEN waba_id IS NULL THEN NULL ELSE 'waba_' || ${fakeHash("wa-waba")} END,
			phone_number_id = CASE WHEN phone_number_id IS NULL THEN NULL ELSE 'phone_' || ${fakeHash("wa-phone-id")} END,
			verified_name = CASE WHEN verified_name IS NULL THEN NULL ELSE 'Verified business ' || left(${fakeHash("wa-verified-name")}, 10) END,
			access_token = NULL,
			app_secret = NULL,
			webhook_verify_token = NULL,
			last_error_message = NULL,
			webhook_url = NULL,
			settings = CASE WHEN settings IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE wa_contacts AS contact SET
			wa_id = '+1999' || lpad(numbered.ordinal::text, 11, '0'),
			phone_number = CASE WHEN phone_number IS NULL THEN NULL ELSE ${fakePhone("wa-contact-phone", "contact.id")} END,
			push_name = CASE WHEN push_name IS NULL THEN NULL ELSE 'Contact ' || left(${fakeHash("wa-contact-push", "contact.id")}, 10) END,
			name = CASE WHEN name IS NULL THEN NULL ELSE 'Contact ' || left(${fakeHash("wa-contact-name", "contact.id")}, 10) END,
			email = CASE WHEN email IS NULL THEN NULL ELSE 'contact+' || ${fakeHash("wa-contact-email", "contact.id")} || '@example.invalid' END,
			tags = CASE WHEN tags IS NULL THEN NULL ELSE '[]'::jsonb END,
			custom_fields = CASE WHEN custom_fields IS NULL THEN NULL ELSE '{}'::jsonb END,
			external_source = CASE WHEN external_source IS NULL THEN NULL ELSE 'sanitized' END,
			external_id = CASE WHEN external_id IS NULL THEN NULL ELSE 'external_' || ${fakeHash("wa-contact-external", "contact.id")} END
		FROM (
			SELECT id, row_number() OVER (PARTITION BY account_id ORDER BY id) AS ordinal
			FROM wa_contacts
		) AS numbered
		WHERE contact.id = numbered.id`,
		`UPDATE wa_conversations SET
			last_message_preview = CASE WHEN last_message_preview IS NULL THEN NULL ELSE 'Sanitized message preview' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE wa_media SET
			provider_media_id = CASE WHEN provider_media_id IS NULL THEN NULL ELSE 'media_' || ${fakeHash("wa-media-provider")} END,
			file_name = CASE WHEN file_name IS NULL THEN NULL ELSE 'sanitized-' || left(${fakeHash("wa-media-file")}, 12) END,
			storage_url = CASE WHEN storage_url IS NULL THEN NULL ELSE 'https://example.invalid/whatsapp/media/' || ${fakeHash("wa-media-url")} END,
			thumbnail_url = CASE WHEN thumbnail_url IS NULL THEN NULL ELSE 'https://example.invalid/whatsapp/thumbnails/' || ${fakeHash("wa-thumbnail-url")} END,
			ingest_status = CASE WHEN ingest_status IN ('pending', 'processing') THEN 'failed'::wa_media_ingest_status ELSE ingest_status END,
			next_ingest_attempt_at = NULL,
			ingest_locked_by = NULL,
			ingest_lease_expires_at = NULL,
			ingest_error_message = CASE
				WHEN ingest_status IN ('pending', 'processing') THEN 'Disabled in sanitized staging snapshot'
				WHEN ingest_error_message IS NULL THEN NULL
				ELSE 'Sanitized media ingestion failure'
			END`,
		`UPDATE wa_messages SET
			provider_message_id = CASE WHEN provider_message_id IS NULL THEN NULL ELSE 'wamid_sanitized_' || ${fakeHash("wa-message-provider")} END,
			text_body = CASE WHEN text_body IS NULL THEN NULL ELSE 'Sanitized WhatsApp message' END,
			caption = CASE WHEN caption IS NULL THEN NULL ELSE 'Sanitized caption' END,
			template_name = CASE WHEN template_name IS NULL THEN NULL ELSE 'sanitized_template' END,
			template_params = CASE WHEN template_params IS NULL THEN NULL ELSE '{}'::jsonb END,
			interactive_data = CASE WHEN interactive_data IS NULL THEN NULL ELSE '{}'::jsonb END,
			status = CASE WHEN status IN ('pending', 'queued') THEN 'failed'::wa_message_status ELSE status END,
			error_code = NULL,
			error_message = NULL,
			raw_payload = CASE WHEN raw_payload IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE wa_events SET
			provider_event_id = 'event_sanitized_' || ${fakeHash("wa-event-provider")},
			payload = '{}'::jsonb,
			error_message = NULL,
			processing_status = 'processed',
			processed_at = COALESCE(processed_at, now()),
			next_attempt_at = now(),
			locked_by = NULL,
			lease_expires_at = NULL`,
		`UPDATE wa_outbox SET
			status = CASE WHEN status IN ('pending', 'processing', 'failed') THEN 'failed'::wa_outbox_status ELSE status END,
			attempts = CASE WHEN status IN ('pending', 'processing', 'failed') THEN COALESCE(max_attempts, 3) ELSE attempts END,
			next_attempt_at = NULL,
			locked_by = NULL,
			lease_expires_at = NULL,
			dispatch_token = NULL,
			dispatch_started_at = NULL,
			error_message = CASE
				WHEN status IN ('pending', 'processing', 'failed') THEN 'Disabled in sanitized staging snapshot'
				WHEN error_message IS NULL THEN NULL
				ELSE 'Sanitized delivery failure'
			END`,
		`UPDATE wa_campaigns SET
			name = 'Campaign ' || left(${fakeHash("wa-campaign")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized campaign' END,
			status = CASE WHEN status IN ('scheduled', 'running', 'paused') THEN 'cancelled'::wa_campaign_status ELSE status END,
			text_body = CASE WHEN text_body IS NULL THEN NULL ELSE 'Sanitized campaign message' END,
			template_name = CASE WHEN template_name IS NULL THEN NULL ELSE 'sanitized_template' END,
			template_params = CASE WHEN template_params IS NULL THEN NULL ELSE '{}'::jsonb END,
			audience_filter = CASE WHEN audience_filter IS NULL THEN NULL ELSE '{}'::jsonb END,
			scheduled_at = CASE WHEN status IN ('scheduled', 'running', 'paused') THEN NULL ELSE scheduled_at END`,
		`UPDATE wa_bot_flows SET
			name = 'Automation ' || left(${fakeHash("wa-bot-flow")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized automation' END,
			status = CASE WHEN status = 'published' THEN 'archived'::wa_bot_flow_status ELSE status END,
			flow_data = '{}'::jsonb,
			trigger_keywords = CASE WHEN trigger_keywords IS NULL THEN NULL ELSE '[]'::jsonb END`,
		`UPDATE wa_automation_runs SET
			trigger_identity = 'trigger_' || ${fakeHash("wa-automation-trigger")},
			action_snapshot = '{}'::jsonb,
			status = CASE WHEN status IN ('pending', 'processing', 'waiting') THEN 'failed'::wa_automation_run_status ELSE status END,
			next_attempt_at = NULL,
			locked_by = NULL,
			lease_expires_at = NULL,
			last_error = CASE WHEN status IN ('pending', 'processing', 'waiting') THEN 'Disabled in sanitized staging snapshot' ELSE NULL END`,
		`UPDATE wa_automation_actions SET
			payload = '{}'::jsonb,
			status = CASE WHEN status IN ('pending', 'processing', 'waiting') THEN 'failed'::wa_automation_action_status ELSE status END,
			attempts = CASE WHEN status IN ('pending', 'processing', 'waiting', 'failed') THEN max_attempts ELSE attempts END,
			next_attempt_at = NULL,
			locked_by = NULL,
			lease_expires_at = NULL,
			wait_until = NULL,
			last_error = CASE WHEN status IN ('pending', 'processing', 'waiting') THEN 'Disabled in sanitized staging snapshot' ELSE NULL END`,
		`UPDATE wa_campaign_recipients SET
			status = CASE WHEN status IN ('pending', 'queued') THEN 'suppressed'::wa_campaign_recipient_status ELSE status END,
			suppressed_at = CASE WHEN status IN ('pending', 'queued') THEN COALESCE(suppressed_at, now()) ELSE suppressed_at END,
			suppression_reason = CASE
				WHEN status IN ('pending', 'queued') THEN 'Disabled in sanitized staging snapshot'
				WHEN suppression_reason IS NULL THEN NULL
				ELSE 'Sanitized suppression reason'
			END,
			failure_message = CASE WHEN failure_message IS NULL THEN NULL ELSE 'Sanitized delivery failure' END`,
		`UPDATE wa_manual_send_idempotency SET
			idempotency_key = left(${fakeHash("wa-manual-idempotency")}, 32),
			request_fingerprint = ${fakeHash("wa-manual-fingerprint")}`,
		`UPDATE wa_templates SET
			provider_template_id = CASE WHEN provider_template_id IS NULL THEN NULL ELSE 'template_' || ${fakeHash("wa-provider-template")} END,
			name = 'sanitized_' || left(${fakeHash("wa-template-name")}, 20),
			components = CASE WHEN components IS NULL THEN NULL ELSE '[]'::jsonb END,
			rejected_reason = NULL`,
	]);
}
