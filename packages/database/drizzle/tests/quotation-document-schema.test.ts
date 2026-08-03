import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
	new URL("../migrations/0054_thankful_forgotten_one.sql", import.meta.url),
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
