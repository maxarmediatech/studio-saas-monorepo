import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
	new URL("../migrations/0054_thankful_forgotten_one.sql", import.meta.url),
	"utf8",
);
const termsMigration = readFileSync(
	new URL(
		"../migrations/0055_quotation_terms_configuration.sql",
		import.meta.url,
	),
	"utf8",
);
const termsBackfillMigration = readFileSync(
	new URL(
		"../migrations/0056_quotation_terms_neutral_backfill.sql",
		import.meta.url,
	),
	"utf8",
);
const shootLinkMigration = readFileSync(
	new URL("../migrations/0057_chemical_frank_castle.sql", import.meta.url),
	"utf8",
);
const presentationMigration = readFileSync(
	new URL("../migrations/0058_big_jack_murdock.sql", import.meta.url),
	"utf8",
);

test("quotation document migration preserves lifecycle and immutable evidence", () => {
	assert.match(migration, /client_lifecycle_stage/);
	assert.match(migration, /booking_events_timeline_shape/);
	assert.match(migration, /quotes_document_fields_complete/);
	assert.match(migration, /quotes_pdf_fields_complete/);
	assert.match(migration, /quotes_protect_immutable_document/);
	assert.match(migration, /quote_acceptances_protect_immutable_update/);
	assert.match(migration, /old_quote_id.*OLD\.quote_id/s);
	assert.match(migration, /q\.id = old_quote_id/);
	assert.match(migration, /q\.id = new_quote_id/);
	assert.match(migration, /quote_line_items_protect_immutable_document/);
});

test("quotation terms use a transaction-safe configuration enum migration", () => {
	assert.match(
		termsMigration,
		/CREATE TYPE "public"\."config_type" AS ENUM[\s\S]*'quotation_terms'/,
	);
	assert.match(termsMigration, /ALTER COLUMN "type" TYPE/);
	assert.doesNotMatch(termsMigration, /ADD VALUE/);
});

test("existing organizations receive an idempotent neutral terms preset", () => {
	assert.match(termsBackfillMigration, /FROM "organizations"/);
	assert.match(termsBackfillMigration, /WHERE NOT EXISTS/);
	assert.match(termsBackfillMigration, /'quotation_terms'::"config_type"/);
	assert.match(termsBackfillMigration, /"is_default"/);
	assert.match(termsBackfillMigration, /"percentage":"40"/);
	assert.match(termsBackfillMigration, /"percentage":"50"/);
	assert.match(termsBackfillMigration, /"percentage":"10"/);
	assert.match(termsBackfillMigration, /"deliveryTimelines":\[\]/);
	assert.match(termsBackfillMigration, /"fixedTerms":\[\]/);
	assert.doesNotMatch(
		termsBackfillMigration,
		/extra services|travel|accommodation|weather|cancellation/i,
	);
});

test("quotation template persistence freezes tenant-safe render evidence", () => {
	assert.match(presentationMigration, /ADD VALUE 'preparing' BEFORE 'sent'/);
	assert.match(
		presentationMigration,
		/CREATE TABLE "quotation_presentations"/,
	);
	assert.match(
		presentationMigration,
		/CREATE TABLE "quotation_pdf_render_intents"/,
	);
	assert.match(
		presentationMigration,
		/FOREIGN KEY \("quote_id","organization_id","quote_version"\)/,
	);
	assert.match(
		presentationMigration,
		/quotation_pdf_render_intents_idempotency_unique/,
	);
	assert.match(
		presentationMigration,
		/quotation_pdf_render_intents_completed_quote_version_unique/,
	);
	assert.match(
		presentationMigration,
		/quotation_presentations_protect_lifecycle/,
	);
	assert.match(
		presentationMigration,
		/quotation_pdf_render_intents_frozen_input_immutable/,
	);
	assert.match(
		presentationMigration,
		/quotation_pdf_render_intents_completed_immutable/,
	);
	assert.match(
		presentationMigration,
		/quotation_pdf_render_intents_require_completed_attachment/,
	);
	assert.match(presentationMigration, /quotes_pdf_provenance_matches_intent/);
	assert.match(presentationMigration, /quotes_preparing_document_immutable/);
	assert.doesNotMatch(
		presentationMigration,
		/INSERT INTO "?quotation_presentations"?[\s\S]+SELECT[\s\S]+FROM "?quotes"?/,
	);
	assert.ok(
		presentationMigration.indexOf("quotes_id_org_version_unique") <
			presentationMigration.indexOf(
				"quotation_pdf_render_intents_quote_id_organization_id_quote_version",
			),
		"composite quote target must precede render-intent FK",
	);
});

test("quotation shoots retain their booking event and side", () => {
	assert.match(shootLinkMigration, /ADD COLUMN "booking_event_id"/);
	assert.match(shootLinkMigration, /ADD COLUMN "side" "event_side"/);
	assert.match(
		shootLinkMigration,
		/FOREIGN KEY \("booking_event_id"\).*"booking_events"\("id"\).*ON DELETE set null/,
	);
	assert.match(shootLinkMigration, /CREATE INDEX "shoots_booking_event_idx"/);
});
