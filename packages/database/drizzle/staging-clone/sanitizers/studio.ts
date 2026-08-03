import type { Client } from "pg";
import { executeSanitizer, fakeHash, fakePhone } from "./helpers";

export const PRESERVED_TASK_METADATA_KEYS = [
	"convertedFromDeliverableId",
] as const;
export const PRESERVED_DELIVERABLE_METADATA_KEYS = [
	"convertedToTaskId",
	"convertedAt",
] as const;

function preserveMetadataKeys(column: string, keys: readonly string[]): string {
	const keyValuePairs = keys.flatMap((key) => [
		`'${key}'`,
		`${column} -> '${key}'`,
	]);
	return `CASE WHEN ${column} IS NULL THEN NULL ELSE jsonb_strip_nulls(jsonb_build_object(${keyValuePairs.join(", ")})) END`;
}

export async function sanitizeStudio(
	client: Client,
	sanitizationKey: string,
): Promise<void> {
	await executeSanitizer(client, sanitizationKey, [
		`UPDATE configurations SET
			label = 'Sanitized configuration ' || left(${fakeHash("configuration-label")}, 8),
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
			notes = CASE WHEN notes IS NULL THEN NULL ELSE 'Sanitized event notes' END,
			date_window = CASE WHEN date_window IS NULL THEN NULL ELSE 'Sanitized date window' END,
			coverage_notes = CASE WHEN coverage_notes IS NULL THEN NULL ELSE 'Sanitized coverage' END`,
		`CREATE OR REPLACE FUNCTION pg_temp.sanitize_quotation_document(input jsonb) RETURNS jsonb
		LANGUAGE sql IMMUTABLE AS $$
			SELECT CASE WHEN input IS NULL THEN NULL ELSE
				jsonb_set(jsonb_set(jsonb_set(
					jsonb_set(input || jsonb_build_object('quotationType', COALESCE(input -> 'quotationType', '{}'::jsonb) || jsonb_build_object('label', 'Sanitized quotation type')), '{title}', to_jsonb('Sanitized quotation'::text), true),
					'{participants}', COALESCE((SELECT jsonb_agg(participant || jsonb_build_object('contact',
						COALESCE(participant -> 'contact', '{}'::jsonb) || jsonb_build_object(
							'name', 'Sanitized client', 'email', CASE WHEN participant #>> '{contact,email}' IS NULL THEN NULL ELSE 'client@example.invalid' END,
							'phoneNumber', CASE WHEN participant #>> '{contact,phoneNumber}' IS NULL THEN NULL ELSE '+910000000000' END,
							'alternatePhone', CASE WHEN participant #>> '{contact,alternatePhone}' IS NULL THEN NULL ELSE '+910000000001' END,
							'address', CASE WHEN participant #>> '{contact,address}' IS NULL THEN NULL ELSE 'Sanitized address' END,
							'profession', CASE WHEN participant #>> '{contact,profession}' IS NULL THEN NULL ELSE 'Sanitized profession' END,
							'source', CASE WHEN participant #>> '{contact,source}' IS NULL THEN NULL ELSE 'Sanitized source' END,
							'socialHandle', CASE WHEN participant #>> '{contact,socialHandle}' IS NULL THEN NULL ELSE '@sanitized' END,
							'notes', CASE WHEN participant #>> '{contact,notes}' IS NULL THEN NULL ELSE 'Sanitized notes' END
						))) FROM jsonb_array_elements(COALESCE(input -> 'participants', '[]'::jsonb)) participant), '[]'::jsonb), true),
					'{events}', COALESCE((SELECT jsonb_agg(event || jsonb_build_object(
						'eventType', COALESCE(event -> 'eventType', '{}'::jsonb) || jsonb_build_object('label', 'Sanitized event type'),
						'dateWindow', CASE WHEN event ->> 'dateWindow' IS NULL THEN NULL ELSE 'Sanitized date window' END,
						'location', CASE WHEN event ->> 'location' IS NULL THEN NULL ELSE 'Sanitized location' END,
						'notes', CASE WHEN event ->> 'notes' IS NULL THEN NULL ELSE 'Sanitized event notes' END
					)) FROM jsonb_array_elements(COALESCE(input -> 'events', '[]'::jsonb)) event), '[]'::jsonb), true),
					'{packages}', COALESCE((SELECT jsonb_agg(package || jsonb_build_object(
						'name', 'Sanitized package',
						'configuration', CASE WHEN package -> 'configuration' IS NULL OR package -> 'configuration' = 'null'::jsonb THEN NULL ELSE package -> 'configuration' || jsonb_build_object('label', 'Sanitized package configuration', 'description', CASE WHEN package #>> '{configuration,description}' IS NULL THEN NULL ELSE 'Sanitized package configuration' END) END,
						'summary', CASE WHEN package ->> 'summary' IS NULL THEN NULL ELSE 'Sanitized package summary' END,
						'coverage', COALESCE((SELECT jsonb_agg(coverage || jsonb_build_object('roles', CASE WHEN coverage ->> 'roles' IS NULL THEN NULL ELSE 'Sanitized coverage' END)) FROM jsonb_array_elements(COALESCE(package -> 'coverage', '[]'::jsonb)) coverage), '[]'::jsonb),
						'deliverables', COALESCE((SELECT jsonb_agg(deliverable || jsonb_build_object('name', 'Sanitized deliverable', 'details', CASE WHEN deliverable ->> 'details' IS NULL THEN NULL ELSE 'Sanitized deliverable details' END)) FROM jsonb_array_elements(COALESCE(package -> 'deliverables', '[]'::jsonb)) deliverable), '[]'::jsonb)
					)) FROM jsonb_array_elements(COALESCE(input -> 'packages', '[]'::jsonb)) package), '[]'::jsonb), true)
			END
		$$`,
		`CREATE OR REPLACE FUNCTION pg_temp.sanitize_quotation_clauses(input jsonb) RETURNS jsonb
		LANGUAGE sql IMMUTABLE AS $$
			SELECT CASE WHEN input IS NULL THEN NULL ELSE jsonb_set(jsonb_set(
				jsonb_set(input, '{deliveryTimelines}', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('text', 'Sanitized delivery timeline')) FROM jsonb_array_elements(COALESCE(input -> 'deliveryTimelines', '[]'::jsonb)) item), '[]'::jsonb), true),
				'{fixedTerms}', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('text', 'Sanitized fixed term')) FROM jsonb_array_elements(COALESCE(input -> 'fixedTerms', '[]'::jsonb)) item), '[]'::jsonb), true)
				, '{paymentMilestones}', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('label', 'Sanitized payment milestone', 'timing', 'Sanitized payment timing')) FROM jsonb_array_elements(COALESCE(input -> 'paymentMilestones', '[]'::jsonb)) item), '[]'::jsonb), true)
			END
		$$`,
		`CREATE OR REPLACE FUNCTION pg_temp.sanitize_quotation_blueprint(input jsonb) RETURNS jsonb
		LANGUAGE sql IMMUTABLE AS $$
			SELECT CASE WHEN input IS NULL THEN NULL ELSE input || jsonb_build_object('booking',
				COALESCE(input -> 'booking', '{}'::jsonb) || jsonb_build_object(
					'name', 'Sanitized booking',
					'bookingType', 'Sanitized booking type',
					'packageType', 'Sanitized package type',
					'note', CASE WHEN input #>> '{booking,note}' IS NULL THEN NULL ELSE 'Sanitized booking note' END,
					'events', COALESCE((SELECT jsonb_agg(item || jsonb_build_object(
						'eventType', 'Sanitized event type',
						'dateWindow', CASE WHEN item ->> 'dateWindow' IS NULL THEN NULL ELSE 'Sanitized date window' END,
						'location', CASE WHEN item ->> 'location' IS NULL THEN NULL ELSE 'Sanitized location' END,
						'venue', CASE WHEN item ->> 'venue' IS NULL THEN NULL ELSE 'Sanitized venue' END,
						'venueAddress', CASE WHEN item ->> 'venueAddress' IS NULL THEN NULL ELSE 'Sanitized venue address' END,
						'notes', CASE WHEN item ->> 'notes' IS NULL THEN NULL ELSE 'Sanitized event notes' END,
						'coverageNotes', CASE WHEN item ->> 'coverageNotes' IS NULL THEN NULL ELSE 'Sanitized coverage' END
					)) FROM jsonb_array_elements(COALESCE(input #> '{booking,events}', '[]'::jsonb)) item), '[]'::jsonb),
					'shoots', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('name', 'Sanitized shoot', 'venue', CASE WHEN item ->> 'venue' IS NULL THEN NULL ELSE 'Sanitized venue' END, 'notes', CASE WHEN item ->> 'notes' IS NULL THEN NULL ELSE 'Sanitized shoot notes' END)) FROM jsonb_array_elements(COALESCE(input #> '{booking,shoots}', '[]'::jsonb)) item), '[]'::jsonb),
					'deliverables', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('name', 'Sanitized deliverable', 'description', CASE WHEN item ->> 'description' IS NULL THEN NULL ELSE 'Sanitized deliverable description' END)) FROM jsonb_array_elements(COALESCE(input #> '{booking,deliverables}', '[]'::jsonb)) item), '[]'::jsonb),
					'paymentSchedules', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('name', 'Sanitized payment schedule', 'notes', CASE WHEN item ->> 'notes' IS NULL THEN NULL ELSE 'Sanitized payment notes' END, 'timing', CASE WHEN item ->> 'timing' IS NULL THEN NULL ELSE 'Sanitized payment timing' END)) FROM jsonb_array_elements(COALESCE(input #> '{booking,paymentSchedules}', '[]'::jsonb)) item), '[]'::jsonb),
					'paymentMilestones', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('label', 'Sanitized payment milestone', 'timing', 'Sanitized payment timing')) FROM jsonb_array_elements(COALESCE(input #> '{booking,paymentMilestones}', '[]'::jsonb)) item), '[]'::jsonb),
					'contractAttachment', CASE WHEN input #> '{booking,contractAttachment}' IS NULL OR input #> '{booking,contractAttachment}' = 'null'::jsonb THEN NULL ELSE (input #> '{booking,contractAttachment}') || jsonb_build_object('name', 'Sanitized attachment', 'key', 'sanitized/quotation-attachment') END
				)
			) END
		$$`,
		`UPDATE quotes SET
			title = 'Sanitized quotation',
			client_message = CASE WHEN client_message IS NULL THEN NULL ELSE 'Sanitized client message' END,
			internal_notes = CASE WHEN internal_notes IS NULL THEN NULL ELSE 'Sanitized internal notes' END,
			terms = CASE WHEN terms IS NULL THEN NULL ELSE '["Sanitized term"]'::jsonb END,
			document = pg_temp.sanitize_quotation_clauses(pg_temp.sanitize_quotation_document(document)),
			document_sha256 = CASE WHEN document_sha256 IS NULL THEN NULL ELSE repeat('0', 64) END,
			branding_snapshot = CASE WHEN branding_snapshot IS NULL THEN NULL ELSE branding_snapshot || jsonb_build_object(
				'organizationName', 'Sanitized studio', 'address', NULL, 'email', NULL, 'phone', NULL, 'taxIdentifier', NULL,
				'logoStorageKey', NULL, 'logoMimeType', NULL, 'logoSha256', NULL) END,
			pdf_storage_key = NULL, pdf_sha256 = NULL, pdf_rendered_at = NULL,
			pdf_renderer_version = NULL, pdf_page_count = NULL, pdf_byte_size = NULL`,
		`UPDATE quote_participants SET contact_snapshot = pg_temp.sanitize_quotation_document(
			jsonb_build_object('title', '', 'participants', jsonb_build_array(jsonb_build_object('contact', contact_snapshot)), 'events', '[]'::jsonb, 'packages', '[]'::jsonb)
		) #> '{participants,0,contact}' WHERE contact_snapshot IS NOT NULL`,
		`UPDATE quote_options SET
			name = 'Sanitized package',
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized package description' END,
			booking_blueprint = pg_temp.sanitize_quotation_blueprint(booking_blueprint)`,
		`UPDATE quote_line_items SET description = 'Sanitized quotation line item'`,
		`UPDATE quote_acceptances SET
			document_snapshot = pg_temp.sanitize_quotation_clauses(pg_temp.sanitize_quotation_document(document_snapshot)),
			document_sha256 = CASE WHEN document_sha256 IS NULL THEN NULL ELSE repeat('0', 64) END,
			option_snapshot = CASE WHEN option_snapshot IS NULL THEN NULL ELSE option_snapshot || jsonb_build_object('option',
				COALESCE(option_snapshot -> 'option', '{}'::jsonb) || jsonb_build_object(
					'name', 'Sanitized accepted package',
					'description', CASE WHEN option_snapshot #>> '{option,description}' IS NULL THEN NULL ELSE 'Sanitized accepted package description' END,
					'bookingBlueprint', pg_temp.sanitize_quotation_blueprint(option_snapshot #> '{option,bookingBlueprint}'),
					'lineItems', COALESCE((SELECT jsonb_agg(item || jsonb_build_object('description', 'Sanitized quotation line item')) FROM jsonb_array_elements(COALESCE(option_snapshot #> '{option,lineItems}', '[]'::jsonb)) item), '[]'::jsonb)
				)
			) END,
			pdf_snapshot = NULL`,
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
			metadata = ${preserveMetadataKeys("metadata", PRESERVED_TASK_METADATA_KEYS)}`,
		`UPDATE task_assignments SET
			progress_note = CASE WHEN progress_note IS NULL THEN NULL ELSE 'Sanitized assignment progress note' END`,
		`UPDATE deliverables SET
			name = 'Deliverable ' || left(${fakeHash("deliverable")}, 10),
			description = CASE WHEN description IS NULL THEN NULL ELSE 'Sanitized deliverable description' END,
			metadata = ${preserveMetadataKeys("metadata", PRESERVED_DELIVERABLE_METADATA_KEYS)}`,
		`UPDATE deliverable_assignments SET
			progress_note = CASE WHEN progress_note IS NULL THEN NULL ELSE 'Sanitized assignment progress note' END`,
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
