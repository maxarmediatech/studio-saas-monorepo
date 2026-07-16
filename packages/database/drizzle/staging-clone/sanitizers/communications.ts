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
			access_token = NULL,
			webhook_verify_token = NULL,
			last_error_message = NULL,
			webhook_url = NULL,
			settings = CASE WHEN settings IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE wa_contacts SET
			wa_id = ${fakePhone("wa-contact-id")},
			phone_number = CASE WHEN phone_number IS NULL THEN NULL ELSE ${fakePhone("wa-contact-phone")} END,
			push_name = CASE WHEN push_name IS NULL THEN NULL ELSE 'Contact ' || left(${fakeHash("wa-contact-push")}, 10) END,
			name = CASE WHEN name IS NULL THEN NULL ELSE 'Contact ' || left(${fakeHash("wa-contact-name")}, 10) END,
			email = CASE WHEN email IS NULL THEN NULL ELSE 'contact+' || ${fakeHash("wa-contact-email")} || '@example.invalid' END,
			tags = CASE WHEN tags IS NULL THEN NULL ELSE '[]'::jsonb END,
			custom_fields = CASE WHEN custom_fields IS NULL THEN NULL ELSE '{}'::jsonb END,
			external_source = CASE WHEN external_source IS NULL THEN NULL ELSE 'sanitized' END,
			external_id = CASE WHEN external_id IS NULL THEN NULL ELSE 'external_' || ${fakeHash("wa-contact-external")} END`,
		`UPDATE wa_conversations SET
			last_message_preview = CASE WHEN last_message_preview IS NULL THEN NULL ELSE 'Sanitized message preview' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE wa_media SET
			provider_media_id = CASE WHEN provider_media_id IS NULL THEN NULL ELSE 'media_' || ${fakeHash("wa-media-provider")} END,
			file_name = CASE WHEN file_name IS NULL THEN NULL ELSE 'sanitized-' || left(${fakeHash("wa-media-file")}, 12) END,
			storage_url = CASE WHEN storage_url IS NULL THEN NULL ELSE 'https://example.invalid/whatsapp/media/' || ${fakeHash("wa-media-url")} END,
			thumbnail_url = CASE WHEN thumbnail_url IS NULL THEN NULL ELSE 'https://example.invalid/whatsapp/thumbnails/' || ${fakeHash("wa-thumbnail-url")} END`,
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
			error_message = NULL`,
		`UPDATE wa_outbox SET
			status = 'failed',
			attempts = max_attempts,
			next_attempt_at = NULL,
			error_message = 'Disabled in sanitized staging snapshot'
		WHERE status IN ('pending', 'processing')`,
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
	]);
}
