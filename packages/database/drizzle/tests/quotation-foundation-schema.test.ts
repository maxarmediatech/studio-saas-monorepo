import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
	bookings,
	documentSequences,
	quotationPdfRenderIntents,
	quotationPresentations,
	quoteAcceptances,
	quoteLineItems,
	quoteOptions,
	quoteParticipants,
	quotes,
} from "../schema/studio";

function columns(items: { name: string }[]): string[] {
	return items.map((item) => item.name);
}

function hasUniqueTarget(
	table: Parameters<typeof getTableConfig>[0],
	names: string[],
) {
	const config = getTableConfig(table);
	return (
		config.indexes.some(
			(index) =>
				index.config.unique &&
				columns(index.config.columns as { name: string }[]).join(
					",",
				) === names.join(","),
		) ||
		config.uniqueConstraints.some(
			(constraint) =>
				columns(constraint.columns).join(",") === names.join(","),
		)
	);
}

function hasForeignKey(
	table: Parameters<typeof getTableConfig>[0],
	local: string[],
	foreign: string[],
): boolean {
	return getTableConfig(table).foreignKeys.some((key) => {
		const reference = key.reference();
		return (
			columns(reference.columns).join(",") === local.join(",") &&
			columns(reference.foreignColumns).join(",") === foreign.join(",")
		);
	});
}

test("quotation foreign keys have exact organization-scoped unique targets", () => {
	assert.equal(
		hasUniqueTarget(quoteOptions, ["id", "organization_id"]),
		true,
	);
	assert.equal(
		hasUniqueTarget(quoteOptions, ["id", "organization_id", "quote_id"]),
		true,
	);
	assert.equal(
		hasForeignKey(
			quoteLineItems,
			["quote_option_id", "organization_id"],
			["id", "organization_id"],
		),
		true,
	);
	assert.equal(
		hasForeignKey(
			quoteAcceptances,
			["quote_option_id", "organization_id", "quote_id"],
			["id", "organization_id", "quote_id"],
		),
		true,
	);
	assert.equal(
		hasForeignKey(
			quotationPresentations,
			["quote_id", "organization_id"],
			["id", "organization_id"],
		),
		true,
	);
	assert.equal(
		hasForeignKey(
			quotationPdfRenderIntents,
			["quote_id", "organization_id", "quote_version"],
			["id", "organization_id", "version"],
		),
		true,
	);
	assert.equal(
		hasForeignKey(
			bookings,
			["source_quote_option_id", "organization_id", "source_quote_id"],
			["id", "organization_id", "quote_id"],
		),
		true,
	);
});

test("quotation presentation and render-intent identities stay singular", () => {
	const intentConfig = getTableConfig(quotationPdfRenderIntents);
	assert.equal(quotationPresentations.quoteId.primary, true);
	assert.equal(
		intentConfig.uniqueConstraints.some(
			(item) =>
				item.name === "quotation_pdf_render_intents_idempotency_unique",
		),
		true,
	);
	assert.equal(
		intentConfig.indexes.some(
			(item) =>
				item.config.name ===
					"quotation_pdf_render_intents_completed_quote_version_unique" &&
				item.config.unique &&
				item.config.where !== undefined,
		),
		true,
	);
});

test("quotation aggregate uniqueness and blueprint version checks stay enforced", () => {
	const optionConfig = getTableConfig(quoteOptions);
	const participantConfig = getTableConfig(quoteParticipants);
	assert.equal(
		optionConfig.indexes.some(
			(index) =>
				index.config.name === "quote_options_recommended_unique_idx" &&
				index.config.unique &&
				index.config.where !== undefined,
		),
		true,
	);
	assert.equal(
		participantConfig.indexes.some(
			(index) =>
				index.config.name === "quote_participants_primary_unique_idx" &&
				index.config.unique &&
				index.config.where !== undefined,
		),
		true,
	);
	assert.equal(
		optionConfig.checks.some(
			(check) =>
				check.name ===
				"quote_options_blueprint_version_matches_payload",
		),
		true,
	);
});

test("quote numbering extends the existing document sequence guard", async () => {
	assert.equal(
		getTableConfig(documentSequences).checks.some(
			(item) => item.name === "document_sequences_type_check",
		),
		true,
	);
	const migration = await readFile(
		new URL("../migrations/0051_fluffy_dragon_man.sql", import.meta.url),
		"utf8",
	);
	assert.match(
		migration,
		/document_type IN \('invoice', 'receipt', 'quote'\)/,
	);
});

test("conversion and version evidence stays unique across soft deletion", async () => {
	const bookingIndexes = getTableConfig(bookings).indexes;
	const sourceQuoteIndex = bookingIndexes.find(
		(index) => index.config.name === "bookings_source_quote_unique_idx",
	);
	assert.equal(sourceQuoteIndex?.config.unique, true);
	assert.deepEqual(
		columns(sourceQuoteIndex?.config.columns as { name: string }[]),
		["organization_id", "source_quote_id"],
	);
	const sourceQuoteWhere =
		(
			sourceQuoteIndex?.config.where as
				| { queryChunks?: Array<{ value?: string[] }> }
				| undefined
		)?.queryChunks
			?.flatMap((chunk) => chunk.value ?? [])
			.join("") ?? "";
	assert.match(sourceQuoteWhere, /source_quote_id/i);
	assert.doesNotMatch(sourceQuoteWhere, /deleted_at/i);
	const quoteNumberConstraint = getTableConfig(quotes).uniqueConstraints.find(
		(constraint) => constraint.name === "quotes_org_number_version_unique",
	);
	assert.deepEqual(columns(quoteNumberConstraint?.columns ?? []), [
		"organization_id",
		"quote_number",
		"version",
	]);

	const migration = await readFile(
		new URL(
			"../migrations/0050_freezing_newton_destine.sql",
			import.meta.url,
		),
		"utf8",
	);
	assert.doesNotMatch(migration, /converted_booking_id/);
	assert.match(migration, /bookings_source_quote_unique_idx/);
	assert.match(migration, /quotes_org_number_version_unique/);
	assert.match(
		migration,
		/quote_options_blueprint_version_matches_payload[^;]+jsonb_typeof\(booking_blueprint\) = 'object'[^;]+jsonb_typeof\(booking_blueprint -> 'booking'\) = 'object'[^;]+ELSE false END/,
	);
	assert.match(migration, /quote_options_recommended_unique_idx/);
	assert.match(migration, /quote_participants_primary_unique_idx/);

	const correctionMigration = await readFile(
		new URL("../migrations/0052_magical_korath.sql", import.meta.url),
		"utf8",
	);
	for (const expected of [
		"quote_options_total_formula",
		"amount = round(quantity * unit_price, 2)",
		"bookings_validate_quote_provenance",
		"bookings_source_quote_immutable",
		"FOR UPDATE OF q, qa, qo",
		"NEW.package_cost IS DISTINCT FROM canonical_snapshot_total_text::numeric",
		"quote_acceptances_protect_immutable_update",
		"quote_acceptances_immutable",
		"quote_options_protect_linked_update",
		"quote_line_items_guard_evidence",
		"quote_options_validate_subtotal",
		"DEFERRABLE INITIALLY DEFERRED",
		"quote_options_subtotal_line_sum",
		"clients_protect_quote_participant_evidence",
		"quotes_validate_lineage",
		"quotes_valid_lineage",
		"ON DELETE cascade",
	]) {
		assert.ok(
			correctionMigration.includes(expected),
			`missing 0052 evidence: ${expected}`,
		);
	}

	const orderingCases = [
		{
			target: 'CONSTRAINT "quotes_id_org_unique" UNIQUE',
			foreignKey:
				'CONSTRAINT "quote_acceptances_quote_id_organization_id_quotes_id_organization_id_fk" FOREIGN KEY',
		},
		{
			target: 'CONSTRAINT "quote_options_id_org_unique" UNIQUE',
			foreignKey:
				'CONSTRAINT "quote_line_items_quote_option_id_organization_id_quote_options_id_organization_id_fk" FOREIGN KEY',
		},
		{
			target: 'CONSTRAINT "quote_options_id_org_quote_unique" UNIQUE',
			foreignKey:
				'CONSTRAINT "quote_acceptances_quote_option_id_organization_id_quote_id_quote_options_id_organization_id_quote_id_fk" FOREIGN KEY',
		},
		{
			target: 'ALTER TABLE "clients" ADD CONSTRAINT "clients_id_org_unique" UNIQUE',
			foreignKey:
				'CONSTRAINT "quote_participants_client_id_organization_id_clients_id_organization_id_fk" FOREIGN KEY',
		},
	];
	for (const { target, foreignKey } of orderingCases) {
		const targetPosition = migration.indexOf(target);
		const foreignKeyPosition = migration.indexOf(foreignKey);
		assert.ok(targetPosition >= 0, `missing target: ${target}`);
		assert.ok(foreignKeyPosition >= 0, `missing FK: ${foreignKey}`);
		assert.ok(
			targetPosition < foreignKeyPosition,
			`target must precede FK: ${target}`,
		);
	}
});
