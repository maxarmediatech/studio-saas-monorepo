import type { Client } from "pg";
import { executeSanitizer, fakeHash, fakePhone } from "./helpers";

export async function sanitizeStudio(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE configurations SET
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized configuration' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE clients SET
			name = 'Client ' || left(${fakeHash("client")}, 10),
			email = CASE WHEN email IS NULL THEN NULL ELSE 'client+' || ${fakeHash("client-email")} || '@example.invalid' END,
			phone_number = CASE WHEN phone_number IS NULL THEN NULL ELSE ${fakePhone("client-phone")} END,
			alternate_phone = CASE WHEN alternate_phone IS NULL THEN NULL ELSE ${fakePhone("client-alt-phone")} END,
			address = CASE WHEN address IS NULL THEN NULL ELSE 'Sanitized address ' || left(${fakeHash("client-address")}, 8) END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE bookings SET
			name = 'Booking ' || left(${fakeHash("booking")}, 10),
			note = CASE WHEN note IS NULL THEN NULL ELSE 'Sanitized booking note' END`,
		`UPDATE booking_events SET
			venue = CASE WHEN venue IS NULL THEN NULL ELSE 'Venue ' || left(${fakeHash("booking-event-venue")}, 8) END,
			venue_address = CASE WHEN venue_address IS NULL THEN NULL ELSE 'Sanitized venue address' END,
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized event notes' END`,
		`UPDATE crews SET
			name = 'Crew ' || left(${fakeHash("crew")}, 10),
			email = CASE WHEN email IS NULL THEN NULL ELSE 'crew+' || ${fakeHash("crew-email")} || '@example.invalid' END,
			phone_number = CASE WHEN phone_number IS NULL THEN NULL ELSE ${fakePhone("crew-phone")} END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE crew_availability SET reason = CASE WHEN reason IS NULL THEN NULL ELSE 'Sanitized availability reason' END`,
		`UPDATE shoots SET
			name = 'Shoot ' || left(${fakeHash("shoot")}, 10),
			venue = CASE WHEN venue IS NULL THEN NULL ELSE 'Venue ' || left(${fakeHash("shoot-venue")}, 8) END,
			venue_address = CASE WHEN venue_address IS NULL THEN NULL ELSE 'Sanitized venue address' END,
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized shoot notes' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE tasks SET
			name = 'Task ' || left(${fakeHash("task")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized task description' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE deliverables SET
			name = 'Deliverable ' || left(${fakeHash("deliverable")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized deliverable description' END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE assignment_submissions SET
			submission_note = CASE WHEN submission_note IS NULL THEN NULL ELSE 'Sanitized submission note' END,
			submission_links = CASE WHEN submission_links IS NULL THEN NULL ELSE '[]'::jsonb END,
			review_note = CASE WHEN review_note IS NULL THEN NULL ELSE 'Sanitized review note' END`,
		`UPDATE submission_files SET
			file_name = 'sanitized-' || left(${fakeHash("submission-file")}, 12),
			file_url = 'https://example.invalid/submissions/' || ${fakeHash("submission-file-url")}`,
		`UPDATE submission_feedback SET comment = CASE WHEN comment IS NULL THEN NULL ELSE 'Sanitized feedback' END`,
		`UPDATE attachments SET
			file_name = 'sanitized-' || left(${fakeHash("attachment")}, 12),
			file_url = 'https://example.invalid/attachments/' || ${fakeHash("attachment-url")},
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized attachment' END`,
		`UPDATE quick_links SET
			title = 'Link ' || left(${fakeHash("quick-link")}, 10),
			url = 'https://example.invalid/links/' || ${fakeHash("quick-link-url")},
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE notifications SET
			entity_name = CASE WHEN entity_name IS NULL THEN NULL ELSE 'Sanitized entity' END,
			title = 'Sanitized notification',
			body = 'Sanitized notification body',
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END,
			actor_name = CASE WHEN actor_name IS NULL THEN NULL ELSE 'Sanitized actor' END`,
		`UPDATE stickies SET
			title = 'Sticky ' || left(${fakeHash("sticky")}, 10),
			content = 'Sanitized sticky content',
			description_html = CASE WHEN description_html IS NULL THEN NULL ELSE '<p>Sanitized sticky content</p>' END`,
		`UPDATE saved_views SET
			name = 'View ' || left(${fakeHash("saved-view")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized saved view' END,
			filters = '{}'::jsonb,
			display_filters = CASE WHEN display_filters IS NULL THEN NULL ELSE '{}'::jsonb END`,
		`UPDATE activities SET
			actor_name = CASE WHEN actor_name IS NULL THEN NULL ELSE 'Sanitized actor' END,
			entity_name = CASE WHEN entity_name IS NULL THEN NULL ELSE 'Sanitized entity' END,
			parent_entity_name = CASE WHEN parent_entity_name IS NULL THEN NULL ELSE 'Sanitized parent' END,
			old_value = CASE WHEN old_value IS NULL THEN NULL ELSE 'Sanitized value' END,
			new_value = CASE WHEN new_value IS NULL THEN NULL ELSE 'Sanitized value' END,
			old_identifier = CASE WHEN old_identifier IS NULL THEN NULL ELSE 'sanitized_' || left(${fakeHash("activity-old")}, 20) END,
			new_identifier = CASE WHEN new_identifier IS NULL THEN NULL ELSE 'sanitized_' || left(${fakeHash("activity-new")}, 20) END,
			metadata = CASE WHEN metadata IS NULL THEN NULL ELSE '{}'::jsonb END`,
	]);
}
