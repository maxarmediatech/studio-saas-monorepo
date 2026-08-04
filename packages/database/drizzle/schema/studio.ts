import { relations, sql } from "drizzle-orm";
import {
	boolean,
	check,
	date,
	decimal,
	foreignKey,
	index,
	integer,
	jsonb,
	type PgTableExtraConfigValue,
	pgTable,
	text,
	time,
	timestamp,
	unique,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import {
	invitations,
	members,
	organizationRoles,
	organizations,
	purchases,
	teams,
} from "./core";
import {
	assignmentProgressStatusEnum,
	billToEnum,
	bookingPhaseEnum,
	clientLifecycleStageEnum,
	configTypeEnum,
	deliverableTaskLinkKindEnum,
	deliverableTrackingModeEnum,
	eventSideEnum,
	invoiceStatusEnum,
	lineItemTypeEnum,
	paymentMethodEnum,
	paymentScheduleStatusEnum,
	quoteStatusEnum,
	submissionStatusEnum,
	taxTypeEnum,
	workflowStatusEnum,
} from "./enums";

// ============================================================================
// CONFIGURATIONS TABLE
// Per-organization customizable settings (statuses, priorities, categories)
// ============================================================================

export const configurations = pgTable(
	"configurations",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		type: configTypeEnum("type").notNull(),
		key: varchar("key", { length: 100 }).notNull(),
		label: text("label").notNull(),
		description: text("description"),

		color: varchar("color", { length: 20 }),
		icon: varchar("icon", { length: 50 }),
		sortOrder: integer("sort_order").default(0).notNull(),

		isDefault: boolean("is_default").default(false).notNull(),
		isSystem: boolean("is_system").default(false).notNull(),
		isActive: boolean("is_active").default(true).notNull(),
		metadata: jsonb("metadata"),
		defaultCost: decimal("default_cost", { precision: 12, scale: 2 }),
		bookingTypeFilter: varchar("booking_type_filter", { length: 100 }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("configurations_org_type_key_idx").on(
			table.organizationId,
			table.type,
			table.key,
		),
		uniqueIndex("configurations_org_type_default_idx")
			.on(table.organizationId, table.type)
			.where(sql`is_default = true`),
		index("configurations_org_type_idx").on(
			table.organizationId,
			table.type,
		),
	],
);

// ============================================================================
// CLIENTS TABLE
// Customer/contact management for studio bookings
// ============================================================================

export const clients = pgTable(
	"clients",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		name: text("name").notNull(),
		email: text("email"),
		phoneNumber: text("phone_number"),
		alternatePhone: text("alternate_phone"),
		address: text("address"),
		metadata: jsonb("metadata"),
		lifecycleStage: clientLifecycleStageEnum("lifecycle_stage")
			.default("client")
			.notNull(),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		unique("clients_id_org_unique").on(table.id, table.organizationId),
		index("clients_organization_idx").on(table.organizationId),
		index("clients_org_lifecycle_created_idx").on(
			table.organizationId,
			table.lifecycleStage,
			table.createdAt,
		),
		index("clients_org_lifecycle_name_idx").on(
			table.organizationId,
			table.lifecycleStage,
			sql`lower(${table.name})`,
		),
		uniqueIndex("clients_org_phone_idx")
			.on(table.organizationId, table.phoneNumber)
			.where(sql`phone_number IS NOT NULL AND deleted_at IS NULL`),
		uniqueIndex("clients_org_email_idx")
			.on(table.organizationId, table.email)
			.where(sql`email IS NOT NULL AND deleted_at IS NULL`),
	],
);

// ============================================================================
// BOOKINGS TABLES
// Core entity - represents a wedding/event project
// ============================================================================

export const bookings = pgTable(
	"bookings",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		referenceNumber: varchar("reference_number", { length: 50 }).notNull(),
		name: text("name").notNull(),
		bookingDate: date("booking_date").default(sql`CURRENT_DATE`).notNull(),

		bookingType: text("booking_type").notNull(),
		packageType: text("package_type").notNull(),
		packageCost: decimal("package_cost", {
			precision: 12,
			scale: 2,
		}).notNull(),

		status: bookingPhaseEnum("status").notNull().default("new"),

		totalReceived: decimal("total_received", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),

		note: text("note"),

		// Migration-level triggers make sourced provenance and packageCost immutable,
		// and lock/validate them against the immutable acceptance snapshot.
		sourceQuoteId: varchar("source_quote_id", { length: 255 }),
		sourceQuoteOptionId: varchar("source_quote_option_id", {
			length: 255,
		}),
		sourceQuoteNumber: varchar("source_quote_number", { length: 50 }),
		sourceQuoteVersion: integer("source_quote_version"),
		sourceBookingBlueprintVersion: integer(
			"source_booking_blueprint_version",
		),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table): PgTableExtraConfigValue[] => [
		uniqueIndex("bookings_id_org_idx").on(table.id, table.organizationId),
		uniqueIndex("bookings_org_ref_idx")
			.on(table.organizationId, table.referenceNumber)
			.where(sql`deleted_at IS NULL`),
		index("bookings_org_status_idx").on(table.organizationId, table.status),
		index("bookings_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		index("bookings_org_booking_date_idx").on(
			table.organizationId,
			table.bookingDate,
		),
		index("bookings_source_quote_idx").on(
			table.organizationId,
			table.sourceQuoteId,
		),
		uniqueIndex("bookings_source_quote_unique_idx")
			.on(table.organizationId, table.sourceQuoteId)
			.where(sql`source_quote_id IS NOT NULL`),
		uniqueIndex("bookings_source_quote_option_unique_idx")
			.on(table.organizationId, table.sourceQuoteOptionId)
			.where(sql`source_quote_option_id IS NOT NULL`),
		foreignKey({
			columns: [table.sourceQuoteId, table.organizationId],
			foreignColumns: [quotes.id, quotes.organizationId],
		}).onDelete("no action"),
		foreignKey({
			columns: [
				table.sourceQuoteOptionId,
				table.organizationId,
				table.sourceQuoteId,
			],
			foreignColumns: [
				quoteOptions.id,
				quoteOptions.organizationId,
				quoteOptions.quoteId,
			],
		}).onDelete("no action"),
		check(
			"bookings_source_quote_complete",
			sql`(source_quote_id IS NULL AND source_quote_option_id IS NULL AND source_quote_number IS NULL AND source_quote_version IS NULL AND source_booking_blueprint_version IS NULL) OR (source_quote_id IS NOT NULL AND source_quote_option_id IS NOT NULL AND source_quote_number IS NOT NULL AND source_quote_version IS NOT NULL AND source_booking_blueprint_version IS NOT NULL)`,
		),
		check(
			"bookings_source_versions_positive",
			sql`(source_quote_version IS NULL OR source_quote_version > 0) AND (source_booking_blueprint_version IS NULL OR source_booking_blueprint_version > 0)`,
		),
	],
);

export const bookingParticipants = pgTable(
	"booking_participants",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		bookingId: varchar("booking_id", { length: 255 }).notNull(),
		clientId: varchar("client_id", { length: 255 })
			.notNull()
			.references(() => clients.id, { onDelete: "cascade" }),

		role: text("role").notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.bookingId],
			foreignColumns: [bookings.id],
		}).onDelete("cascade"),
		uniqueIndex("booking_participants_uniq_idx").on(
			table.bookingId,
			table.clientId,
			table.role,
		),
		index("booking_participants_booking_idx").on(table.bookingId),
		index("booking_participants_client_idx").on(table.clientId),
	],
);

export const bookingEvents = pgTable(
	"booking_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		eventType: text("event_type").notNull(),
		eventDate: timestamp("event_date", { withTimezone: true }),
		side: eventSideEnum("side").default("common").notNull(),
		guestCount: text("guest_count"),
		isTentative: boolean("is_tentative").default(false).notNull(),
		dateWindow: text("date_window"),
		coverageNotes: text("coverage_notes"),
		venue: text("venue"),
		venueAddress: text("venue_address"),
		notes: text("notes"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("booking_events_booking_idx").on(table.bookingId),
		index("booking_events_org_date_idx").on(
			table.organizationId,
			table.eventDate,
		),
		index("booking_events_date_idx").on(table.eventDate),
		check(
			"booking_events_timeline_shape",
			sql`(is_tentative = false AND event_date IS NOT NULL AND date_window IS NULL) OR (is_tentative = true AND event_date IS NULL AND nullif(btrim(date_window), '') IS NOT NULL)`,
		),
	],
);

// ============================================================================
// QUOTATION TABLES
// Versioned commercial proposals. Accepted options carry a validated booking
// blueprint so conversion materializes the existing booking graph exactly once.
// ============================================================================

export const quotes = pgTable(
	"quotes",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		quoteNumber: varchar("quote_number", { length: 50 }).notNull(),
		version: integer("version").default(1).notNull(),
		supersedesQuoteId: varchar("supersedes_quote_id", { length: 255 }),
		status: quoteStatusEnum("status").default("draft").notNull(),
		title: text("title").notNull(),
		currency: varchar("currency", { length: 3 }).default("INR").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		terms: jsonb("terms"),
		clientMessage: text("client_message"),
		internalNotes: text("internal_notes"),
		documentVersion: integer("document_version"),
		document: jsonb("document"),
		documentSha256: varchar("document_sha256", { length: 64 }),
		documentRevision: integer("document_revision").default(0).notNull(),
		brandingSnapshot: jsonb("branding_snapshot"),
		pdfStorageKey: text("pdf_storage_key"),
		pdfSha256: varchar("pdf_sha256", { length: 64 }),
		pdfRenderedAt: timestamp("pdf_rendered_at", { withTimezone: true }),
		pdfRendererVersion: varchar("pdf_renderer_version", { length: 100 }),
		pdfPageCount: integer("pdf_page_count"),
		pdfByteSize: integer("pdf_byte_size"),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		convertedAt: timestamp("converted_at", { withTimezone: true }),
		declinedAt: timestamp("declined_at", { withTimezone: true }),
		expiredAt: timestamp("expired_at", { withTimezone: true }),
		supersededAt: timestamp("superseded_at", { withTimezone: true }),
		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table): PgTableExtraConfigValue[] => [
		unique("quotes_id_org_unique").on(table.id, table.organizationId),
		unique("quotes_org_number_version_unique").on(
			table.organizationId,
			table.quoteNumber,
			table.version,
		),
		uniqueIndex("quotes_supersedes_unique_idx")
			.on(table.organizationId, table.supersedesQuoteId)
			.where(sql`supersedes_quote_id IS NOT NULL`),
		foreignKey({
			columns: [table.supersedesQuoteId, table.organizationId],
			foreignColumns: [table.id, table.organizationId],
		}).onDelete("no action"),
		index("quotes_org_status_idx").on(table.organizationId, table.status),
		index("quotes_org_expires_idx").on(
			table.organizationId,
			table.expiresAt,
		),
		check("quotes_version_positive", sql`version > 0`),
		check(
			"quotes_no_self_lineage",
			sql`supersedes_quote_id IS NULL OR supersedes_quote_id <> id`,
		),
		check("quotes_currency_iso_length", sql`char_length(currency) = 3`),
		check(
			"quotes_document_revision_non_negative",
			sql`document_revision >= 0`,
		),
		check(
			"quotes_document_fields_complete",
			sql`document_version IS NULL OR (document_version = 1 AND document IS NOT NULL AND document_sha256 IS NOT NULL)`,
		),
		check(
			"quotes_pdf_fields_complete",
			sql`(pdf_storage_key IS NULL AND pdf_sha256 IS NULL AND pdf_rendered_at IS NULL AND pdf_renderer_version IS NULL AND pdf_page_count IS NULL AND pdf_byte_size IS NULL) OR (pdf_storage_key IS NOT NULL AND pdf_sha256 IS NOT NULL AND pdf_rendered_at IS NOT NULL AND pdf_renderer_version IS NOT NULL AND pdf_page_count > 0 AND pdf_byte_size > 0)`,
		),
	],
);

export const quoteParticipants = pgTable(
	"quote_participants",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 }).notNull(),
		quoteId: varchar("quote_id", { length: 255 }).notNull(),
		clientId: varchar("client_id", { length: 255 }).notNull(),
		role: varchar("role", { length: 100 }).notNull(),
		side: varchar("side", { length: 50 }),
		isPrimary: boolean("is_primary").default(false).notNull(),
		documentKey: varchar("document_key", { length: 255 }),
		contactSnapshot: jsonb("contact_snapshot"),
		sortOrder: integer("sort_order").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.quoteId, table.organizationId],
			foreignColumns: [quotes.id, quotes.organizationId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.clientId, table.organizationId],
			foreignColumns: [clients.id, clients.organizationId],
		}).onDelete("cascade"),
		uniqueIndex("quote_participants_unique_idx").on(
			table.quoteId,
			table.clientId,
			table.role,
		),
		index("quote_participants_quote_idx").on(table.quoteId),
		uniqueIndex("quote_participants_document_key_unique_idx")
			.on(table.quoteId, table.documentKey)
			.where(sql`document_key IS NOT NULL`),
		uniqueIndex("quote_participants_primary_unique_idx")
			.on(table.quoteId)
			.where(sql`is_primary = true`),
		index("quote_participants_org_client_idx").on(
			table.organizationId,
			table.clientId,
		),
	],
);

export const quoteOptions = pgTable(
	"quote_options",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 }).notNull(),
		quoteId: varchar("quote_id", { length: 255 }).notNull(),
		name: text("name").notNull(),
		description: text("description"),
		subtotal: decimal("subtotal", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		discountAmount: decimal("discount_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		taxAmount: decimal("tax_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		bookingBlueprintVersion: integer("booking_blueprint_version")
			.default(1)
			.notNull(),
		bookingBlueprint: jsonb("booking_blueprint").notNull(),
		isRecommended: boolean("is_recommended").default(false).notNull(),
		documentKey: varchar("document_key", { length: 255 }),
		sortOrder: integer("sort_order").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table): PgTableExtraConfigValue[] => [
		foreignKey({
			columns: [table.quoteId, table.organizationId],
			foreignColumns: [quotes.id, quotes.organizationId],
		}).onDelete("cascade"),
		unique("quote_options_id_org_unique").on(
			table.id,
			table.organizationId,
		),
		unique("quote_options_id_org_quote_unique").on(
			table.id,
			table.organizationId,
			table.quoteId,
		),
		uniqueIndex("quote_options_quote_sort_idx").on(
			table.quoteId,
			table.sortOrder,
		),
		uniqueIndex("quote_options_recommended_unique_idx")
			.on(table.quoteId)
			.where(sql`is_recommended = true`),
		index("quote_options_quote_idx").on(table.quoteId),
		uniqueIndex("quote_options_document_key_unique_idx")
			.on(table.quoteId, table.documentKey)
			.where(sql`document_key IS NOT NULL`),
		check(
			"quote_options_amounts_non_negative",
			sql`subtotal >= 0 AND discount_amount >= 0 AND tax_amount >= 0 AND total_amount >= 0`,
		),
		check(
			"quote_options_total_formula",
			sql`discount_amount <= subtotal AND total_amount = subtotal - discount_amount + tax_amount`,
		),
		check(
			"quote_options_blueprint_version_positive",
			sql`booking_blueprint_version > 0`,
		),
		check(
			"quote_options_blueprint_version_matches_payload",
			sql`CASE WHEN jsonb_typeof(booking_blueprint) = 'object' AND jsonb_typeof(booking_blueprint -> 'booking') = 'object' AND jsonb_typeof(booking_blueprint -> 'schemaVersion') = 'number' AND (booking_blueprint ->> 'schemaVersion') ~ '^[1-9][0-9]*$' THEN booking_blueprint_version = (booking_blueprint ->> 'schemaVersion')::integer ELSE false END`,
		),
	],
);

// A deferred migration-level constraint trigger enforces option.subtotal as the
// final transaction-wide sum of line amounts while allowing option-first writes.
export const quoteLineItems = pgTable(
	"quote_line_items",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 }).notNull(),
		quoteOptionId: varchar("quote_option_id", { length: 255 }).notNull(),
		type: lineItemTypeEnum("type").default("item").notNull(),
		description: text("description").notNull(),
		quantity: decimal("quantity", { precision: 10, scale: 2 }),
		unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.quoteOptionId, table.organizationId],
			foreignColumns: [quoteOptions.id, quoteOptions.organizationId],
		}).onDelete("cascade"),
		index("quote_line_items_option_idx").on(table.quoteOptionId),
		check("quote_line_items_amount_non_negative", sql`amount >= 0`),
		check(
			"quote_line_items_shape",
			sql`(type IN ('item', 'service') AND quantity IS NOT NULL AND quantity > 0 AND unit_price IS NOT NULL AND unit_price >= 0 AND amount = round(quantity * unit_price, 2)) OR (type IN ('milestone', 'expense') AND quantity IS NULL AND unit_price IS NULL)`,
		),
	],
);

export const quoteAcceptances = pgTable(
	"quote_acceptances",
	{
		quoteId: varchar("quote_id", { length: 255 }).primaryKey(),
		organizationId: varchar("organization_id", { length: 255 }).notNull(),
		quoteOptionId: varchar("quote_option_id", { length: 255 }).notNull(),
		optionSnapshot: jsonb("option_snapshot").notNull(),
		documentSnapshot: jsonb("document_snapshot"),
		documentSha256: varchar("document_sha256", { length: 64 }),
		pdfSnapshot: jsonb("pdf_snapshot"),
		acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull(),
		acceptedBy: varchar("accepted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		foreignKey({
			columns: [table.quoteId, table.organizationId],
			foreignColumns: [quotes.id, quotes.organizationId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.quoteOptionId, table.organizationId, table.quoteId],
			foreignColumns: [
				quoteOptions.id,
				quoteOptions.organizationId,
				quoteOptions.quoteId,
			],
		}).onDelete("cascade"),
		uniqueIndex("quote_acceptances_option_unique_idx").on(
			table.organizationId,
			table.quoteOptionId,
		),
	],
);

// ============================================================================
// CREWS TABLE
// Team members who work on shoots (photographers, videographers, editors, etc.)
// ============================================================================

export const crews = pgTable(
	"crews",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Link to user account (optional - crew may not have app access)
		userId: varchar("user_id", { length: 255 }).references(() => users.id, {
			onDelete: "set null",
		}),

		name: text("name").notNull(),
		email: text("email"),
		phoneNumber: text("phone_number"),
		workerType: text("worker_type").default("freelancer").notNull(),

		// Status is TEXT - configurable via configurations table (config_type: crew_status)
		status: text("status").default("active").notNull(),

		dailyRate: decimal("daily_rate", { precision: 10, scale: 2 }),
		metadata: jsonb("metadata"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("crews_organization_idx").on(table.organizationId),
		index("crews_user_idx").on(table.userId),
		index("crews_worker_type_idx").on(table.workerType),
		index("crews_specializations_gin_idx")
			.using("gin", sql`(${table.metadata} -> 'specializations')`)
			.where(sql`${table.deletedAt} IS NULL`),
		uniqueIndex("crews_org_user_active_unique")
			.on(table.organizationId, table.userId)
			.where(sql`user_id IS NOT NULL AND deleted_at IS NULL`),
		uniqueIndex("crews_org_phone_idx")
			.on(table.organizationId, table.phoneNumber)
			.where(sql`phone_number IS NOT NULL AND deleted_at IS NULL`),
	],
);

export const crewAvailability = pgTable(
	"crew_availability",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		crewId: varchar("crew_id", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),

		date: date("date").notNull(),
		isAvailable: boolean("is_available").default(true).notNull(),
		reason: text("reason"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("crew_availability_crew_date_idx").on(
			table.crewId,
			table.date,
		),
		index("crew_availability_date_idx").on(table.date),
	],
);

export const crewFeedbackSummary = pgTable("crew_feedback_summary", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	crewId: varchar("crew_id", { length: 255 })
		.notNull()
		.references(() => crews.id, { onDelete: "cascade" })
		.unique(),

	totalAssignments: integer("total_assignments").default(0).notNull(),
	completedAssignments: integer("completed_assignments").default(0).notNull(),
	averageRating: decimal("average_rating", { precision: 3, scale: 2 }),
	totalEarnings: decimal("total_earnings", { precision: 12, scale: 2 })
		.default("0")
		.notNull(),

	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

// ============================================================================
// SHOOTS TABLE
// Photo/video shoots scheduled for bookings
// ============================================================================

export const shoots = pgTable(
	"shoots",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),
		bookingEventId: varchar("booking_event_id", { length: 255 }).references(
			() => bookingEvents.id,
			{ onDelete: "set null" },
		),

		name: text("name").notNull(),
		shootType: text("shoot_type").notNull(), // pre-wedding, wedding, reception, etc.
		side: eventSideEnum("side"),

		// Proper date and time types (not text!)
		shootDate: date("shoot_date").notNull(),
		startTime: time("start_time"),
		endTime: time("end_time"),

		venue: text("venue"),
		venueAddress: text("venue_address"),
		notes: text("notes"),
		metadata: jsonb("metadata"),

		// Status is TEXT - configurable via configurations table (config_type: shoot_status)
		status: text("status").default("scheduled").notNull(),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("shoots_organization_idx").on(table.organizationId),
		index("shoots_booking_idx").on(table.bookingId),
		index("shoots_booking_event_idx").on(table.bookingEventId),
		index("shoots_date_idx").on(table.shootDate),
		index("shoots_org_date_idx").on(table.organizationId, table.shootDate),
	],
);

export const shootAssignments = pgTable(
	"shoot_assignments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		shootId: varchar("shoot_id", { length: 255 })
			.notNull()
			.references(() => shoots.id, { onDelete: "cascade" }),
		crewId: varchar("crew_id", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),

		role: text("role").notNull(), // lead_photographer, assistant, etc.
		isLead: boolean("is_lead").default(false).notNull(),
		rate: decimal("rate", { precision: 10, scale: 2 }), // per-shoot rate (nullable, defaults to crew.dailyRate)

		assignedBy: varchar("assigned_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("shoot_assignments_shoot_crew_idx").on(
			table.shootId,
			table.crewId,
		),
		index("shoot_assignments_crew_idx").on(table.crewId),
	],
);

// ============================================================================
// TASKS TABLE
// Production tasks (editing, color grading, etc.)
// ============================================================================

export const tasks = pgTable(
	"tasks",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		name: text("name").notNull(),
		description: text("description"),

		// Status is TEXT - configurable via configurations table (config_type: task_status)
		status: text("status").default("pending").notNull(),
		// Priority is TEXT - configurable via configurations table (config_type: task_priority)
		priority: text("priority").default("normal").notNull(),

		// Workflow status is ENUM - system-defined, cannot be customized
		workflowStatus: workflowStatusEnum("workflow_status")
			.default("not_started")
			.notNull(),

		dueDate: date("due_date"),
		completedAt: timestamp("completed_at", { withTimezone: true }),

		metadata: jsonb("metadata"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("tasks_organization_idx").on(table.organizationId),
		index("tasks_booking_idx").on(table.bookingId),
		index("tasks_org_status_idx").on(table.organizationId, table.status),
		index("tasks_org_workflow_idx").on(
			table.organizationId,
			table.workflowStatus,
		),
		index("tasks_due_date_idx").on(table.dueDate),
		uniqueIndex("tasks_org_booking_id_idx").on(
			table.organizationId,
			table.bookingId,
			table.id,
		),
	],
);

export const taskAssignments = pgTable(
	"task_assignments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		taskId: varchar("task_id", { length: 255 })
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		crewId: varchar("crew_id", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),
		progressStatus: assignmentProgressStatusEnum("progress_status")
			.default("assigned")
			.notNull(),
		progressNote: text("progress_note"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		blockedAt: timestamp("blocked_at", { withTimezone: true }),

		assignedBy: varchar("assigned_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("task_assignments_task_crew_idx").on(
			table.taskId,
			table.crewId,
		),
		index("task_assignments_crew_idx").on(table.crewId),
	],
);

// ============================================================================
// DELIVERABLES TABLE
// Final outputs (albums, videos, etc.)
// ============================================================================

export const deliverables = pgTable(
	"deliverables",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		name: text("name").notNull(),
		description: text("description"),

		// Package relationship fields
		quantity: integer("quantity").default(1).notNull(),
		cost: decimal("cost", { precision: 10, scale: 2 }), // nullable - only for custom deliverables
		isPackageIncluded: boolean("is_package_included")
			.default(false)
			.notNull(),

		// Status is TEXT - configurable via configurations table (config_type: deliverable_status)
		status: text("status").default("pending").notNull(),

		// Workflow status is ENUM - system-defined, cannot be customized
		workflowStatus: workflowStatusEnum("workflow_status")
			.default("not_started")
			.notNull(),
		trackingMode: deliverableTrackingModeEnum("tracking_mode")
			.default("direct")
			.notNull(),

		dueDate: date("due_date"),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),

		metadata: jsonb("metadata"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("deliverables_organization_idx").on(table.organizationId),
		index("deliverables_booking_idx").on(table.bookingId),
		index("deliverables_org_status_idx").on(
			table.organizationId,
			table.status,
		),
		index("deliverables_org_workflow_idx").on(
			table.organizationId,
			table.workflowStatus,
		),
		index("deliverables_due_date_idx").on(table.dueDate),
		uniqueIndex("deliverables_org_booking_id_idx").on(
			table.organizationId,
			table.bookingId,
			table.id,
		),
	],
);

export const deliverableAssignments = pgTable(
	"deliverable_assignments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		deliverableId: varchar("deliverable_id", { length: 255 })
			.notNull()
			.references(() => deliverables.id, { onDelete: "cascade" }),
		crewId: varchar("crew_id", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),
		progressStatus: assignmentProgressStatusEnum("progress_status")
			.default("assigned")
			.notNull(),
		progressNote: text("progress_note"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		blockedAt: timestamp("blocked_at", { withTimezone: true }),

		isLead: boolean("is_lead").default(false).notNull(),

		assignedBy: varchar("assigned_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("deliverable_assignments_del_crew_idx").on(
			table.deliverableId,
			table.crewId,
		),
		index("deliverable_assignments_crew_idx").on(table.crewId),
	],
);

export const deliverableTaskLinks = pgTable(
	"deliverable_task_links",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 }).notNull(),
		deliverableId: varchar("deliverable_id", { length: 255 }).notNull(),
		taskId: varchar("task_id", { length: 255 }).notNull(),
		kind: deliverableTaskLinkKindEnum("kind").default("required").notNull(),
		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("deliverable_task_links_pair_idx").on(
			table.deliverableId,
			table.taskId,
		),
		index("deliverable_task_links_task_idx").on(table.taskId),
		index("deliverable_task_links_deliverable_idx").on(table.deliverableId),
		foreignKey({
			columns: [
				table.organizationId,
				table.bookingId,
				table.deliverableId,
			],
			foreignColumns: [
				deliverables.organizationId,
				deliverables.bookingId,
				deliverables.id,
			],
			name: "deliverable_task_links_deliverable_scope_fk",
		}).onDelete("cascade"),
		foreignKey({
			columns: [table.organizationId, table.bookingId, table.taskId],
			foreignColumns: [tasks.organizationId, tasks.bookingId, tasks.id],
			name: "deliverable_task_links_task_scope_fk",
		}).onDelete("cascade"),
	],
);

// ============================================================================
// SUBMISSIONS TABLE
// Work submissions for review (applies to tasks and deliverables)
// ============================================================================

export const assignmentSubmissions = pgTable(
	"assignment_submissions",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Polymorphic reference - either task or deliverable
		taskId: varchar("task_id", { length: 255 }).references(() => tasks.id, {
			onDelete: "cascade",
		}),
		deliverableId: varchar("deliverable_id", { length: 255 }).references(
			() => deliverables.id,
			{ onDelete: "cascade" },
		),

		submittedBy: varchar("submitted_by", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),

		status: submissionStatusEnum("status").default("draft").notNull(),

		submissionNote: text("submission_note"),
		submissionLinks: jsonb("submission_links"),
		submittedAt: timestamp("submitted_at", { withTimezone: true }),

		reviewedBy: varchar("reviewed_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		reviewClaimedAt: timestamp("review_claimed_at", { withTimezone: true }),
		reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
		reviewNote: text("review_note"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("assignment_submissions_org_idx").on(table.organizationId),
		index("assignment_submissions_task_idx").on(table.taskId),
		index("assignment_submissions_deliverable_idx").on(table.deliverableId),
		index("assignment_submissions_crew_idx").on(table.submittedBy),
		index("assignment_submissions_status_idx").on(table.status),
		index("assignment_submissions_review_claim_idx").on(
			table.organizationId,
			table.status,
			table.reviewClaimedAt,
		),
		check(
			"assignment_submissions_task_or_deliverable",
			sql`(task_id IS NOT NULL AND deliverable_id IS NULL) OR (task_id IS NULL AND deliverable_id IS NOT NULL)`,
		),
	],
);

export const submissionFiles = pgTable(
	"submission_files",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		submissionId: varchar("submission_id", { length: 255 })
			.notNull()
			.references(() => assignmentSubmissions.id, {
				onDelete: "cascade",
			}),

		fileName: text("file_name").notNull(),
		fileUrl: text("file_url").notNull(),
		fileSize: integer("file_size"),
		mimeType: text("mime_type"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("submission_files_submission_idx").on(table.submissionId),
	],
);

export const submissionFeedback = pgTable(
	"submission_feedback",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		submissionId: varchar("submission_id", { length: 255 })
			.notNull()
			.references(() => assignmentSubmissions.id, {
				onDelete: "cascade",
			}),

		feedbackBy: varchar("feedback_by", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		comment: text("comment").notNull(),
		rating: integer("rating"), // 1-5 scale

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("submission_feedback_submission_idx").on(table.submissionId),
		check(
			"submission_feedback_rating_range",
			sql`rating IS NULL OR (rating >= 1 AND rating <= 5)`,
		),
	],
);

// ============================================================================
// RECEIVED AMOUNTS TABLE
// Payments received from clients for bookings
// ============================================================================

export const receivedAmounts = pgTable(
	"received_amounts",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
		paymentMethod: paymentMethodEnum("payment_method").notNull(),
		transactionReference: varchar("transaction_reference", { length: 100 }),

		receivedDate: date("received_date").notNull(),
		notes: text("notes"),

		// Proof of payment attachment metadata (name, size, type, key, url)
		proofAttachment: jsonb("proof_attachment"),

		// Link to payment schedule if this fulfills a scheduled payment
		paymentScheduleId: varchar("payment_schedule_id", {
			length: 255,
		}).references(() => paymentSchedules.id, { onDelete: "set null" }),

		// Link to invoice if this payment is for a specific invoice
		invoiceId: varchar("invoice_id", {
			length: 255,
		}).references(() => invoices.id, { onDelete: "set null" }),

		// Corrections preserve the original payment and link it to one active
		// replacement. Reversed rows are also soft-deleted from operational totals.
		replacesPaymentId: varchar("replaces_payment_id", { length: 255 }),
		replacementPaymentId: varchar("replacement_payment_id", {
			length: 255,
		}),
		reversedAt: timestamp("reversed_at", { withTimezone: true }),
		reversedBy: varchar("reversed_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		reversalReason: text("reversal_reason"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("received_amounts_org_idx").on(table.organizationId),
		index("received_amounts_booking_idx").on(table.bookingId),
		index("received_amounts_date_idx").on(table.receivedDate),
		index("received_amounts_schedule_idx").on(table.paymentScheduleId),
		index("received_amounts_invoice_idx").on(table.invoiceId),
		uniqueIndex("received_amounts_replaces_payment_idx")
			.on(table.replacesPaymentId)
			.where(sql`replaces_payment_id IS NOT NULL`),
		uniqueIndex("received_amounts_replacement_payment_idx")
			.on(table.replacementPaymentId)
			.where(sql`replacement_payment_id IS NOT NULL`),
		foreignKey({
			columns: [table.replacesPaymentId],
			foreignColumns: [table.id],
			name: "received_amounts_replaces_payment_id_fk",
		}).onDelete("restrict"),
		foreignKey({
			columns: [table.replacementPaymentId],
			foreignColumns: [table.id],
			name: "received_amounts_replacement_payment_id_fk",
		}).onDelete("restrict"),
		check("received_amounts_amount_positive", sql`amount > 0`),
	],
);

// ============================================================================
// PAYMENT IDEMPOTENCY RECORDS
// A processing row is never intentionally committed: claim, payment effects,
// and completion all live in one transaction.
// ============================================================================

export const paymentIdempotencyRecords = pgTable(
	"payment_idempotency_records",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		operation: varchar("operation", { length: 50 }).notNull(),
		idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
		requestFingerprint: varchar("request_fingerprint", {
			length: 64,
		}).notNull(),
		status: varchar("status", { length: 20 })
			.default("processing")
			.notNull(),
		resultResourceId: varchar("result_resource_id", {
			length: 255,
		}).references(() => receivedAmounts.id, { onDelete: "restrict" }),
		resultPayload: jsonb("result_payload").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("payment_idempotency_org_operation_key_idx").on(
			table.organizationId,
			table.operation,
			table.idempotencyKey,
		),
		index("payment_idempotency_result_idx").on(table.resultResourceId),
		check(
			"payment_idempotency_operation_check",
			sql`operation IN ('create_received_payment', 'convert_schedule_payment', 'correct_received_payment')`,
		),
		check(
			"payment_idempotency_status_check",
			sql`status IN ('processing', 'completed')`,
		),
		check(
			"payment_idempotency_completion_check",
			sql`(status = 'processing' AND result_resource_id IS NULL AND result_payload IS NULL AND completed_at IS NULL) OR (status = 'completed' AND result_resource_id IS NOT NULL AND result_payload IS NOT NULL AND completed_at IS NOT NULL)`,
		),
	],
);

// ============================================================================
// PAYMENT SCHEDULES TABLE
// Scheduled payment milestones for bookings
// ============================================================================

export const paymentSchedules = pgTable(
	"payment_schedules",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		name: text("name").notNull(), // "Advance", "Before Wedding", "Final Payment"
		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
		dueDate: date("due_date"),
		percentage: decimal("percentage", { precision: 5, scale: 2 }),
		timing: text("timing"),

		status: paymentScheduleStatusEnum("status")
			.default("pending")
			.notNull(),
		taxType: taxTypeEnum("tax_type").default("exclusive").notNull(),

		paidAmount: decimal("paid_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		paidAt: timestamp("paid_at", { withTimezone: true }),

		notes: text("notes"),
		sortOrder: integer("sort_order").default(0).notNull(),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("payment_schedules_org_idx").on(table.organizationId),
		index("payment_schedules_booking_idx").on(table.bookingId),
		check(
			"payment_schedules_percentage_range",
			sql`percentage IS NULL OR (percentage >= 0 AND percentage <= 100)`,
		),
		index("payment_schedules_due_date_idx").on(table.dueDate),
		index("payment_schedules_status_idx").on(table.status),
		check("payment_schedules_amount_positive", sql`amount > 0`),
		check(
			"payment_schedules_paid_amount_range",
			sql`paid_amount >= 0 AND paid_amount <= amount`,
		),
	],
);

// ============================================================================
// EXPENSES TABLE
// Studio expenses (can be linked to bookings/shoots)
// ============================================================================

export const expenses = pgTable(
	"expenses",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		description: text("description").notNull(),
		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

		// Category is TEXT - configurable via configurations table (config_type: expense_category)
		category: text("category"),

		expenseDate: date("expense_date").notNull(),
		billTo: billToEnum("bill_to").default("studio").notNull(),

		paymentMethod: paymentMethodEnum("payment_method"),
		transactionReference: varchar("transaction_reference", { length: 100 }),
		vendor: text("vendor"),

		notes: text("notes"),
		metadata: jsonb("metadata"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("expenses_org_idx").on(table.organizationId),
		index("expenses_date_idx").on(table.expenseDate),
		index("expenses_org_date_idx").on(
			table.organizationId,
			table.expenseDate,
		),
		index("expenses_category_idx").on(table.category),
		index("expenses_bill_to_idx").on(table.billTo),
		check("expenses_amount_positive", sql`amount > 0`),
	],
);

export const expenseAssignments = pgTable(
	"expense_assignments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		expenseId: varchar("expense_id", { length: 255 })
			.notNull()
			.references(() => expenses.id, { onDelete: "cascade" }),

		// Can be linked to booking, shoot, or crew
		bookingId: varchar("booking_id", { length: 255 }).references(
			() => bookings.id,
			{ onDelete: "cascade" },
		),
		shootId: varchar("shoot_id", { length: 255 }).references(
			() => shoots.id,
			{
				onDelete: "cascade",
			},
		),
		crewId: varchar("crew_id", { length: 255 }).references(() => crews.id, {
			onDelete: "cascade",
		}),

		// Percentage or fixed amount allocation
		allocationPercentage: decimal("allocation_percentage", {
			precision: 5,
			scale: 2,
		}),
		allocationAmount: decimal("allocation_amount", {
			precision: 12,
			scale: 2,
		}),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("expense_assignments_expense_idx").on(table.expenseId),
		index("expense_assignments_booking_idx").on(table.bookingId),
		index("expense_assignments_shoot_idx").on(table.shootId),
		index("expense_assignments_crew_idx").on(table.crewId),
		check(
			"expense_assignments_single_target",
			sql`(booking_id IS NOT NULL AND shoot_id IS NULL AND crew_id IS NULL) OR (booking_id IS NULL AND shoot_id IS NOT NULL AND crew_id IS NULL) OR (booking_id IS NULL AND shoot_id IS NULL AND crew_id IS NOT NULL)`,
		),
	],
);

// ============================================================================
// INVOICES TABLE
// Invoice management for bookings
// ============================================================================

export const invoices = pgTable(
	"invoices",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		// Organization-scoped invoice number
		invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),

		status: invoiceStatusEnum("status").default("draft").notNull(),

		issueDate: date("issue_date").notNull(),
		dueDate: date("due_date"),

		// Link to payment schedule (1:1 relationship to milestone)
		paymentScheduleId: varchar("payment_schedule_id", {
			length: 255,
		}).references(() => paymentSchedules.id, { onDelete: "set null" }),

		// Calculated totals (cached for performance)
		subtotal: decimal("subtotal", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		taxAmount: decimal("tax_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		discountAmount: decimal("discount_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		taxType: taxTypeEnum("tax_type").default("exclusive").notNull(),
		totalAmount: decimal("total_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		paidAmount: decimal("paid_amount", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),

		notes: text("notes"),
		terms: text("terms"),

		sentAt: timestamp("sent_at", { withTimezone: true }),
		paidAt: timestamp("paid_at", { withTimezone: true }),

		metadata: jsonb("metadata"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		uniqueIndex("invoices_org_number_idx")
			.on(table.organizationId, table.invoiceNumber)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex("invoices_active_payment_schedule_idx")
			.on(table.paymentScheduleId)
			.where(sql`payment_schedule_id IS NOT NULL AND deleted_at IS NULL`),
		index("invoices_org_idx").on(table.organizationId),
		index("invoices_booking_idx").on(table.bookingId),
		index("invoices_status_idx").on(table.status),
		index("invoices_issue_date_idx").on(table.issueDate),
		check(
			"invoices_amounts_non_negative",
			sql`subtotal >= 0 AND tax_amount >= 0 AND discount_amount >= 0 AND total_amount >= 0`,
		),
		check(
			"invoices_paid_amount_range",
			sql`paid_amount >= 0 AND paid_amount <= total_amount`,
		),
	],
);

// Transactional counters for human-facing financial document numbers. scopeKey
// preserves the existing booking/date prefix while making allocation atomic.
export const documentSequences = pgTable(
	"document_sequences",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		documentType: varchar("document_type", { length: 32 }).notNull(),
		scopeKey: varchar("scope_key", { length: 255 }).notNull(),
		nextValue: integer("next_value").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("document_sequences_org_type_scope_idx").on(
			table.organizationId,
			table.documentType,
			table.scopeKey,
		),
		check(
			"document_sequences_type_check",
			sql`document_type IN ('invoice', 'receipt', 'quote')`,
		),
		check("document_sequences_next_value_positive", sql`next_value > 0`),
	],
);

export const invoiceLineItems = pgTable(
	"invoice_line_items",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		invoiceId: varchar("invoice_id", { length: 255 })
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),
		type: lineItemTypeEnum("type").default("item").notNull(),

		description: text("description").notNull(),
		quantity: decimal("quantity", { precision: 10, scale: 2 }),
		unitPrice: decimal("unit_price", { precision: 12, scale: 2 }),
		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),

		sortOrder: integer("sort_order").default(0).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("invoice_line_items_invoice_idx").on(table.invoiceId),
		check(
			"invoice_line_items_itemized_check",
			sql`CASE WHEN type IN ('item', 'service') THEN quantity IS NOT NULL AND quantity > 0 AND unit_price IS NOT NULL AND unit_price >= 0 AND amount = quantity * unit_price ELSE TRUE END`,
		),
		check(
			"invoice_line_items_lump_sum_check",
			sql`CASE WHEN type IN ('milestone', 'expense') THEN quantity IS NULL AND unit_price IS NULL AND amount >= 0 ELSE TRUE END`,
		),
	],
);

// ============================================================================
// RECEIPTS TABLE
// Payment receipts for bookings and invoices
// ============================================================================

export const receipts = pgTable(
	"receipts",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		bookingId: varchar("booking_id", { length: 255 })
			.notNull()
			.references(() => bookings.id, { onDelete: "cascade" }),

		// Link to invoice if this receipt is for a specific invoice
		invoiceId: varchar("invoice_id", {
			length: 255,
		}).references(() => invoices.id, { onDelete: "set null" }),

		// Link to received amount if this receipt documents a payment
		receivedAmountId: varchar("received_amount_id", {
			length: 255,
		}).references(() => receivedAmounts.id, { onDelete: "set null" }),

		receiptNumber: varchar("receipt_number", { length: 50 }).notNull(),
		amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
		paymentMethod: varchar("payment_method", { length: 50 }),
		receiptDate: date("receipt_date").notNull(),
		notes: text("notes"),

		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		updatedBy: varchar("updated_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("receipts_org_idx").on(table.organizationId),
		index("receipts_booking_idx").on(table.bookingId),
		index("receipts_invoice_idx").on(table.invoiceId),
		index("receipts_received_amount_idx").on(table.receivedAmountId),
		index("receipts_date_idx").on(table.receiptDate),
		uniqueIndex("receipts_org_number_idx")
			.on(table.organizationId, table.receiptNumber)
			.where(sql`deleted_at IS NULL`),
		uniqueIndex("receipts_active_received_amount_idx")
			.on(table.receivedAmountId)
			.where(sql`received_amount_id IS NOT NULL AND deleted_at IS NULL`),
		check("receipts_amount_positive", sql`amount > 0`),
	],
);

// ============================================================================
// ATTACHMENTS TABLE
// Generic file attachments for any entity
// ============================================================================

export const attachments = pgTable(
	"attachments",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Polymorphic reference - can be attached to any entity
		entityType: varchar("entity_type", { length: 50 }).notNull(), // booking, shoot, expense, invoice, etc.
		entityId: varchar("entity_id", { length: 255 }).notNull(),

		fileName: text("file_name").notNull(),
		fileUrl: text("file_url").notNull(),
		fileSize: integer("file_size"),
		mimeType: text("mime_type"),

		description: text("description"),

		uploadedBy: varchar("uploaded_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),

		deletedAt: timestamp("deleted_at", { withTimezone: true }),
		deletedBy: varchar("deleted_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
	},
	(table) => [
		index("attachments_org_idx").on(table.organizationId),
		index("attachments_entity_idx").on(table.entityType, table.entityId),
	],
);

// ============================================================================
// RECENT VISITS TABLE
// Tracks user's recently visited entities for quick access
// ============================================================================

export const recentVisits = pgTable(
	"recent_visits",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),

		visitedAt: timestamp("visited_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Unique constraint for upsert
		uniqueIndex("recent_visits_user_org_entity_idx").on(
			table.organizationId,
			table.userId,
			table.entityType,
			table.entityId,
		),
		// Query index for listing recents
		index("recent_visits_user_org_visited_idx").on(
			table.organizationId,
			table.userId,
			table.visitedAt,
		),
	],
);

// ============================================================================
// QUICK LINKS TABLE
// Personal bookmarked URLs for quick access on home page
// ============================================================================

export const quickLinks = pgTable(
	"quick_links",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		title: varchar("title", { length: 255 }),
		url: text("url").notNull(),
		metadata: jsonb("metadata"),
		sortOrder: integer("sort_order").default(0).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("quick_links_org_user_idx").on(
			table.organizationId,
			table.userId,
		),
		index("quick_links_org_user_sort_idx").on(
			table.organizationId,
			table.userId,
			table.sortOrder,
		),
	],
);

// ============================================================================
// SUBSCRIPTIONS TABLE
// Tracks which users are watching entities (tasks, deliverables, shoots, etc.)
// ============================================================================

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("subscriptions_user_entity_unique")
			.on(
				table.organizationId,
				table.userId,
				table.entityType,
				table.entityId,
			)
			.where(sql`deleted_at IS NULL`),
		index("subscriptions_org_user_idx").on(
			table.organizationId,
			table.userId,
		),
		index("subscriptions_entity_idx").on(table.entityType, table.entityId),
	],
);

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
	organization: one(organizations, {
		fields: [subscriptions.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id],
	}),
}));

// ============================================================================
// NOTIFICATIONS TABLE
// In-app notifications
// ============================================================================

export const notifications = pgTable(
	"notifications",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),
		entityName: text("entity_name").notNull(),

		type: varchar("type", { length: 50 }).notNull(),
		title: text("title").notNull(),
		body: text("body"),
		metadata: jsonb("metadata"),

		actorId: varchar("actor_id", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		actorName: text("actor_name"),

		readAt: timestamp("read_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("notifications_user_org_idx").on(
			table.organizationId,
			table.userId,
			table.createdAt,
		),
		index("notifications_user_unread_idx")
			.on(table.organizationId, table.userId)
			.where(sql`read_at IS NULL`),
		index("notifications_entity_idx").on(table.entityType, table.entityId),
	],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
	organization: one(organizations, {
		fields: [notifications.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id],
	}),
	actor: one(users, {
		fields: [notifications.actorId],
		references: [users.id],
	}),
}));

export const notificationPreferences = pgTable(
	"notification_preferences",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		assignedToMe: boolean("assigned_to_me").default(true).notNull(),
		itemsIAssigned: boolean("items_i_assigned").default(true).notNull(),
		bookingsIOwn: boolean("bookings_i_own").default(true).notNull(),
		itemsIFollow: boolean("items_i_follow").default(true).notNull(),
		mentions: boolean("mentions").default(true).notNull(),
		dueOverdueReminders: boolean("due_overdue_reminders")
			.default(true)
			.notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("notification_preferences_org_user_idx").on(
			table.organizationId,
			table.userId,
		),
		index("notification_preferences_user_idx").on(table.userId),
	],
);

export const notificationPreferencesRelations = relations(
	notificationPreferences,
	({ one }) => ({
		organization: one(organizations, {
			fields: [notificationPreferences.organizationId],
			references: [organizations.id],
		}),
		user: one(users, {
			fields: [notificationPreferences.userId],
			references: [users.id],
		}),
	}),
);

// ============================================================================
// STICKIES
// Personal notes/reminders for users
// ============================================================================

export const stickies = pgTable(
	"stickies",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		title: varchar("title", { length: 255 }),
		content: text("content"),
		descriptionHtml: text("description_html"),
		color: varchar("color", { length: 50 }).default("yellow").notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("stickies_org_user_idx").on(table.organizationId, table.userId),
		index("stickies_org_user_sort_idx").on(
			table.organizationId,
			table.userId,
			table.sortOrder,
		),
	],
);

// ============================================================================
// RELATIONS
// All studio domain relations defined here
// ============================================================================

export const stickiesRelations = relations(stickies, ({ one }) => ({
	organization: one(organizations, {
		fields: [stickies.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [stickies.userId],
		references: [users.id],
	}),
}));

export const quickLinksRelations = relations(quickLinks, ({ one }) => ({
	organization: one(organizations, {
		fields: [quickLinks.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [quickLinks.userId],
		references: [users.id],
	}),
}));

export const recentVisitsRelations = relations(recentVisits, ({ one }) => ({
	organization: one(organizations, {
		fields: [recentVisits.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [recentVisits.userId],
		references: [users.id],
	}),
}));

export const configurationsRelations = relations(configurations, ({ one }) => ({
	organization: one(organizations, {
		fields: [configurations.organizationId],
		references: [organizations.id],
	}),
}));

export const clientRelations = relations(clients, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [clients.organizationId],
		references: [organizations.id],
	}),
	bookingParticipants: many(bookingParticipants),
	quoteParticipants: many(quoteParticipants),
	createdByUser: one(users, {
		fields: [clients.createdBy],
		references: [users.id],
		relationName: "clientCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [clients.updatedBy],
		references: [users.id],
		relationName: "clientUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [clients.deletedBy],
		references: [users.id],
		relationName: "clientDeletedBy",
	}),
}));

export const bookingRelations = relations(bookings, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [bookings.organizationId],
		references: [organizations.id],
	}),
	participants: many(bookingParticipants),
	events: many(bookingEvents),
	shoots: many(shoots),
	tasks: many(tasks),
	deliverables: many(deliverables),
	receivedAmounts: many(receivedAmounts),
	paymentSchedules: many(paymentSchedules),
	invoices: many(invoices),
	expenseAssignments: many(expenseAssignments),
	sourceQuote: one(quotes, {
		fields: [bookings.sourceQuoteId],
		references: [quotes.id],
	}),
	sourceQuoteOption: one(quoteOptions, {
		fields: [bookings.sourceQuoteOptionId],
		references: [quoteOptions.id],
	}),
	createdByUser: one(users, {
		fields: [bookings.createdBy],
		references: [users.id],
		relationName: "bookingCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [bookings.updatedBy],
		references: [users.id],
		relationName: "bookingUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [bookings.deletedBy],
		references: [users.id],
		relationName: "bookingDeletedBy",
	}),
}));

export const bookingParticipantRelations = relations(
	bookingParticipants,
	({ one }) => ({
		booking: one(bookings, {
			fields: [bookingParticipants.bookingId],
			references: [bookings.id],
		}),
		client: one(clients, {
			fields: [bookingParticipants.clientId],
			references: [clients.id],
		}),
	}),
);

export const bookingEventRelations = relations(
	bookingEvents,
	({ one, many }) => ({
		booking: one(bookings, {
			fields: [bookingEvents.bookingId],
			references: [bookings.id],
		}),
		organization: one(organizations, {
			fields: [bookingEvents.organizationId],
			references: [organizations.id],
		}),
		shoots: many(shoots),
	}),
);

export const quoteRelations = relations(quotes, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [quotes.organizationId],
		references: [organizations.id],
	}),
	supersedesQuote: one(quotes, {
		fields: [quotes.supersedesQuoteId],
		references: [quotes.id],
		relationName: "quoteVersions",
	}),
	supersededByQuote: one(quotes, {
		fields: [quotes.id],
		references: [quotes.supersedesQuoteId],
		relationName: "quoteVersions",
	}),
	participants: many(quoteParticipants),
	options: many(quoteOptions),
	acceptance: one(quoteAcceptances, {
		fields: [quotes.id],
		references: [quoteAcceptances.quoteId],
	}),
	convertedBooking: one(bookings, {
		fields: [quotes.id],
		references: [bookings.sourceQuoteId],
	}),
}));

export const quoteParticipantRelations = relations(
	quoteParticipants,
	({ one }) => ({
		quote: one(quotes, {
			fields: [quoteParticipants.quoteId],
			references: [quotes.id],
		}),
		client: one(clients, {
			fields: [quoteParticipants.clientId],
			references: [clients.id],
		}),
	}),
);

export const quoteOptionRelations = relations(
	quoteOptions,
	({ one, many }) => ({
		quote: one(quotes, {
			fields: [quoteOptions.quoteId],
			references: [quotes.id],
		}),
		lineItems: many(quoteLineItems),
		acceptance: one(quoteAcceptances, {
			fields: [quoteOptions.id],
			references: [quoteAcceptances.quoteOptionId],
		}),
	}),
);

export const quoteLineItemRelations = relations(quoteLineItems, ({ one }) => ({
	option: one(quoteOptions, {
		fields: [quoteLineItems.quoteOptionId],
		references: [quoteOptions.id],
	}),
}));

export const quoteAcceptanceRelations = relations(
	quoteAcceptances,
	({ one }) => ({
		quote: one(quotes, {
			fields: [quoteAcceptances.quoteId],
			references: [quotes.id],
		}),
		option: one(quoteOptions, {
			fields: [quoteAcceptances.quoteOptionId],
			references: [quoteOptions.id],
		}),
		acceptedByUser: one(users, {
			fields: [quoteAcceptances.acceptedBy],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Crew Relations
// ----------------------------------------------------------------------------

export const crewRelations = relations(crews, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [crews.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [crews.userId],
		references: [users.id],
		relationName: "crewUser",
	}),
	availability: many(crewAvailability),
	feedbackSummary: many(crewFeedbackSummary),
	shootAssignments: many(shootAssignments),
	taskAssignments: many(taskAssignments),
	deliverableAssignments: many(deliverableAssignments),
	submissions: many(assignmentSubmissions),
	createdByUser: one(users, {
		fields: [crews.createdBy],
		references: [users.id],
		relationName: "crewCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [crews.updatedBy],
		references: [users.id],
		relationName: "crewUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [crews.deletedBy],
		references: [users.id],
		relationName: "crewDeletedBy",
	}),
}));

export const crewAvailabilityRelations = relations(
	crewAvailability,
	({ one }) => ({
		crew: one(crews, {
			fields: [crewAvailability.crewId],
			references: [crews.id],
		}),
	}),
);

export const crewFeedbackSummaryRelations = relations(
	crewFeedbackSummary,
	({ one }) => ({
		crew: one(crews, {
			fields: [crewFeedbackSummary.crewId],
			references: [crews.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Shoot Relations
// ----------------------------------------------------------------------------

export const shootRelations = relations(shoots, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [shoots.organizationId],
		references: [organizations.id],
	}),
	booking: one(bookings, {
		fields: [shoots.bookingId],
		references: [bookings.id],
	}),
	bookingEvent: one(bookingEvents, {
		fields: [shoots.bookingEventId],
		references: [bookingEvents.id],
	}),
	assignments: many(shootAssignments),
	createdByUser: one(users, {
		fields: [shoots.createdBy],
		references: [users.id],
		relationName: "shootCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [shoots.updatedBy],
		references: [users.id],
		relationName: "shootUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [shoots.deletedBy],
		references: [users.id],
		relationName: "shootDeletedBy",
	}),
}));

export const shootAssignmentRelations = relations(
	shootAssignments,
	({ one }) => ({
		shoot: one(shoots, {
			fields: [shootAssignments.shootId],
			references: [shoots.id],
		}),
		crew: one(crews, {
			fields: [shootAssignments.crewId],
			references: [crews.id],
		}),
		assignedByUser: one(users, {
			fields: [shootAssignments.assignedBy],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Task Relations
// ----------------------------------------------------------------------------

export const taskRelations = relations(tasks, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [tasks.organizationId],
		references: [organizations.id],
	}),
	booking: one(bookings, {
		fields: [tasks.bookingId],
		references: [bookings.id],
	}),
	assignments: many(taskAssignments),
	deliverableLinks: many(deliverableTaskLinks),
	submissions: many(assignmentSubmissions),
	createdByUser: one(users, {
		fields: [tasks.createdBy],
		references: [users.id],
		relationName: "taskCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [tasks.updatedBy],
		references: [users.id],
		relationName: "taskUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [tasks.deletedBy],
		references: [users.id],
		relationName: "taskDeletedBy",
	}),
}));

export const taskAssignmentRelations = relations(
	taskAssignments,
	({ one }) => ({
		task: one(tasks, {
			fields: [taskAssignments.taskId],
			references: [tasks.id],
		}),
		crew: one(crews, {
			fields: [taskAssignments.crewId],
			references: [crews.id],
		}),
		assignedByUser: one(users, {
			fields: [taskAssignments.assignedBy],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Deliverable Relations
// ----------------------------------------------------------------------------

export const deliverableRelations = relations(
	deliverables,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [deliverables.organizationId],
			references: [organizations.id],
		}),
		booking: one(bookings, {
			fields: [deliverables.bookingId],
			references: [bookings.id],
		}),
		assignments: many(deliverableAssignments),
		taskLinks: many(deliverableTaskLinks),
		submissions: many(assignmentSubmissions),
		createdByUser: one(users, {
			fields: [deliverables.createdBy],
			references: [users.id],
			relationName: "deliverableCreatedBy",
		}),
		updatedByUser: one(users, {
			fields: [deliverables.updatedBy],
			references: [users.id],
			relationName: "deliverableUpdatedBy",
		}),
		deletedByUser: one(users, {
			fields: [deliverables.deletedBy],
			references: [users.id],
			relationName: "deliverableDeletedBy",
		}),
	}),
);

export const deliverableAssignmentRelations = relations(
	deliverableAssignments,
	({ one }) => ({
		deliverable: one(deliverables, {
			fields: [deliverableAssignments.deliverableId],
			references: [deliverables.id],
		}),
		crew: one(crews, {
			fields: [deliverableAssignments.crewId],
			references: [crews.id],
		}),
		assignedByUser: one(users, {
			fields: [deliverableAssignments.assignedBy],
			references: [users.id],
		}),
	}),
);

export const deliverableTaskLinkRelations = relations(
	deliverableTaskLinks,
	({ one }) => ({
		deliverable: one(deliverables, {
			fields: [deliverableTaskLinks.deliverableId],
			references: [deliverables.id],
		}),
		task: one(tasks, {
			fields: [deliverableTaskLinks.taskId],
			references: [tasks.id],
		}),
		createdByUser: one(users, {
			fields: [deliverableTaskLinks.createdBy],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Submission Relations
// ----------------------------------------------------------------------------

export const assignmentSubmissionRelations = relations(
	assignmentSubmissions,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [assignmentSubmissions.organizationId],
			references: [organizations.id],
		}),
		task: one(tasks, {
			fields: [assignmentSubmissions.taskId],
			references: [tasks.id],
		}),
		deliverable: one(deliverables, {
			fields: [assignmentSubmissions.deliverableId],
			references: [deliverables.id],
		}),
		submittedByCrew: one(crews, {
			fields: [assignmentSubmissions.submittedBy],
			references: [crews.id],
		}),
		reviewedByUser: one(users, {
			fields: [assignmentSubmissions.reviewedBy],
			references: [users.id],
		}),
		files: many(submissionFiles),
		feedback: many(submissionFeedback),
	}),
);

export const submissionFileRelations = relations(
	submissionFiles,
	({ one }) => ({
		submission: one(assignmentSubmissions, {
			fields: [submissionFiles.submissionId],
			references: [assignmentSubmissions.id],
		}),
	}),
);

export const submissionFeedbackRelations = relations(
	submissionFeedback,
	({ one }) => ({
		submission: one(assignmentSubmissions, {
			fields: [submissionFeedback.submissionId],
			references: [assignmentSubmissions.id],
		}),
		feedbackByUser: one(users, {
			fields: [submissionFeedback.feedbackBy],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Financial Relations
// ----------------------------------------------------------------------------

export const receivedAmountRelations = relations(
	receivedAmounts,
	({ one }) => ({
		organization: one(organizations, {
			fields: [receivedAmounts.organizationId],
			references: [organizations.id],
		}),
		booking: one(bookings, {
			fields: [receivedAmounts.bookingId],
			references: [bookings.id],
		}),
		paymentSchedule: one(paymentSchedules, {
			fields: [receivedAmounts.paymentScheduleId],
			references: [paymentSchedules.id],
		}),
		createdByUser: one(users, {
			fields: [receivedAmounts.createdBy],
			references: [users.id],
			relationName: "receivedAmountCreatedBy",
		}),
		updatedByUser: one(users, {
			fields: [receivedAmounts.updatedBy],
			references: [users.id],
			relationName: "receivedAmountUpdatedBy",
		}),
		deletedByUser: one(users, {
			fields: [receivedAmounts.deletedBy],
			references: [users.id],
			relationName: "receivedAmountDeletedBy",
		}),
	}),
);

export const paymentScheduleRelations = relations(
	paymentSchedules,
	({ one, many }) => ({
		organization: one(organizations, {
			fields: [paymentSchedules.organizationId],
			references: [organizations.id],
		}),
		booking: one(bookings, {
			fields: [paymentSchedules.bookingId],
			references: [bookings.id],
		}),
		receivedAmounts: many(receivedAmounts),
		createdByUser: one(users, {
			fields: [paymentSchedules.createdBy],
			references: [users.id],
			relationName: "paymentScheduleCreatedBy",
		}),
		updatedByUser: one(users, {
			fields: [paymentSchedules.updatedBy],
			references: [users.id],
			relationName: "paymentScheduleUpdatedBy",
		}),
		deletedByUser: one(users, {
			fields: [paymentSchedules.deletedBy],
			references: [users.id],
			relationName: "paymentScheduleDeletedBy",
		}),
	}),
);

export const expenseRelations = relations(expenses, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [expenses.organizationId],
		references: [organizations.id],
	}),
	assignments: many(expenseAssignments),
	createdByUser: one(users, {
		fields: [expenses.createdBy],
		references: [users.id],
		relationName: "expenseCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [expenses.updatedBy],
		references: [users.id],
		relationName: "expenseUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [expenses.deletedBy],
		references: [users.id],
		relationName: "expenseDeletedBy",
	}),
}));

export const expenseAssignmentRelations = relations(
	expenseAssignments,
	({ one }) => ({
		expense: one(expenses, {
			fields: [expenseAssignments.expenseId],
			references: [expenses.id],
		}),
		booking: one(bookings, {
			fields: [expenseAssignments.bookingId],
			references: [bookings.id],
		}),
		shoot: one(shoots, {
			fields: [expenseAssignments.shootId],
			references: [shoots.id],
		}),
		crew: one(crews, {
			fields: [expenseAssignments.crewId],
			references: [crews.id],
		}),
	}),
);

export const invoiceRelations = relations(invoices, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [invoices.organizationId],
		references: [organizations.id],
	}),
	booking: one(bookings, {
		fields: [invoices.bookingId],
		references: [bookings.id],
	}),
	lineItems: many(invoiceLineItems),
	createdByUser: one(users, {
		fields: [invoices.createdBy],
		references: [users.id],
		relationName: "invoiceCreatedBy",
	}),
	updatedByUser: one(users, {
		fields: [invoices.updatedBy],
		references: [users.id],
		relationName: "invoiceUpdatedBy",
	}),
	deletedByUser: one(users, {
		fields: [invoices.deletedBy],
		references: [users.id],
		relationName: "invoiceDeletedBy",
	}),
}));

export const invoiceLineItemRelations = relations(
	invoiceLineItems,
	({ one }) => ({
		invoice: one(invoices, {
			fields: [invoiceLineItems.invoiceId],
			references: [invoices.id],
		}),
	}),
);

export const attachmentRelations = relations(attachments, ({ one }) => ({
	organization: one(organizations, {
		fields: [attachments.organizationId],
		references: [organizations.id],
	}),
	uploadedByUser: one(users, {
		fields: [attachments.uploadedBy],
		references: [users.id],
	}),
	deletedByUser: one(users, {
		fields: [attachments.deletedBy],
		references: [users.id],
		relationName: "attachmentDeletedBy",
	}),
}));

// ============================================================================
// SAVED VIEWS TABLE
// User-customizable views with filters, sorting, and column visibility
// ============================================================================

export const savedViews = pgTable(
	"saved_views",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		createdBy: varchar("created_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),

		entityType: varchar("entity_type", { length: 50 }).notNull(),
		name: text("name").notNull(),
		description: text("description"),
		icon: varchar("icon", { length: 50 }),
		color: varchar("color", { length: 20 }),

		filters: jsonb("filters").default({}).notNull(),
		displayFilters: jsonb("display_filters"),
		columnVisibility: jsonb("column_visibility"),
		sorting: jsonb("sorting"),

		isSystem: boolean("is_system").default(false).notNull(),
		isDefault: boolean("is_default").default(false).notNull(),
		isPublic: boolean("is_public").default(false).notNull(),
		sortOrder: integer("sort_order").default(0).notNull(),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("saved_views_org_idx").on(table.organizationId),
		index("saved_views_org_entity_idx").on(
			table.organizationId,
			table.entityType,
		),
		index("saved_views_created_by_idx").on(table.createdBy),
		uniqueIndex("saved_views_org_entity_name_idx").on(
			table.organizationId,
			table.entityType,
			table.name,
		),
	],
);

export const savedViewFavorites = pgTable(
	"saved_view_favorites",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		savedViewId: varchar("saved_view_id", { length: 255 })
			.notNull()
			.references(() => savedViews.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("saved_view_favorites_view_user_idx").on(
			table.savedViewId,
			table.userId,
		),
		index("saved_view_favorites_user_idx").on(table.userId),
	],
);

export const savedViewRelations = relations(savedViews, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [savedViews.organizationId],
		references: [organizations.id],
	}),
	createdByUser: one(users, {
		fields: [savedViews.createdBy],
		references: [users.id],
		relationName: "savedViewCreatedBy",
	}),
	favorites: many(savedViewFavorites),
}));

export const savedViewFavoriteRelations = relations(
	savedViewFavorites,
	({ one }) => ({
		savedView: one(savedViews, {
			fields: [savedViewFavorites.savedViewId],
			references: [savedViews.id],
		}),
		user: one(users, {
			fields: [savedViewFavorites.userId],
			references: [users.id],
		}),
	}),
);

// ----------------------------------------------------------------------------
// Organization Relations (includes all studio domain tables)
// ----------------------------------------------------------------------------

export const organizationRelations = relations(organizations, ({ many }) => ({
	members: many(members),
	invitations: many(invitations),
	teams: many(teams),
	purchases: many(purchases),
	organizationRoles: many(organizationRoles),
	configurations: many(configurations),
	clients: many(clients),
	bookings: many(bookings),
	quotes: many(quotes),
	crews: many(crews),
	shoots: many(shoots),
	tasks: many(tasks),
	deliverables: many(deliverables),
	submissions: many(assignmentSubmissions),
	receivedAmounts: many(receivedAmounts),
	paymentSchedules: many(paymentSchedules),
	expenses: many(expenses),
	invoices: many(invoices),
	attachments: many(attachments),
	savedViews: many(savedViews),
	activities: many(activities),
}));

// ============================================================================
// ACTIVITIES TABLE
// Organization-wide activity tracking for audit and feed display
// ============================================================================

export const activities = pgTable(
	"activities",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Who performed the action
		actorId: varchar("actor_id", { length: 255 }).notNull(),
		actorType: varchar("actor_type", { length: 20 }).notNull(), // 'user' | 'crew' | 'system'
		actorName: text("actor_name").notNull(), // Denormalized for display

		// What entity was affected
		entityType: varchar("entity_type", { length: 50 }).notNull(),
		entityId: varchar("entity_id", { length: 255 }).notNull(),
		entityName: text("entity_name").notNull(), // Denormalized: "Smith Wedding"

		// Parent context (for nested entities like tasks belonging to bookings)
		parentEntityType: varchar("parent_entity_type", { length: 50 }),
		parentEntityId: varchar("parent_entity_id", { length: 255 }),
		parentEntityName: text("parent_entity_name"),

		// What happened
		action: varchar("action", { length: 50 }).notNull(),

		// What changed (for updates)
		field: varchar("field", { length: 50 }),
		oldValue: text("old_value"),
		newValue: text("new_value"),
		oldIdentifier: varchar("old_identifier", { length: 255 }), // UUID for relations
		newIdentifier: varchar("new_identifier", { length: 255 }),

		// Grouping & metadata
		epoch: decimal("epoch", { precision: 20, scale: 6 }), // Groups related activities
		metadata: jsonb("metadata"),

		// Timestamp only - activities are immutable, no updatedAt/deletedAt
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Primary query: recent activities for an organization
		index("activities_org_created_idx").on(
			table.organizationId,
			table.createdAt,
		),
		// Query by entity: activity history for a specific entity
		index("activities_entity_idx").on(
			table.entityType,
			table.entityId,
			table.createdAt,
		),
		// Query by actor: what has a user/crew done
		index("activities_actor_idx").on(
			table.actorId,
			table.actorType,
			table.createdAt,
		),
		// Query by parent: activities for a booking's children
		index("activities_parent_idx").on(
			table.parentEntityType,
			table.parentEntityId,
			table.createdAt,
		),
		// Filter by action type
		index("activities_org_action_idx").on(
			table.organizationId,
			table.action,
		),
	],
);

export const activityRelations = relations(activities, ({ one }) => ({
	organization: one(organizations, {
		fields: [activities.organizationId],
		references: [organizations.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;

export type Configuration = typeof configurations.$inferSelect;
export type NewConfiguration = typeof configurations.$inferInsert;

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;

export type BookingParticipant = typeof bookingParticipants.$inferSelect;
export type NewBookingParticipant = typeof bookingParticipants.$inferInsert;

export type BookingEvent = typeof bookingEvents.$inferSelect;
export type NewBookingEvent = typeof bookingEvents.$inferInsert;

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type QuoteParticipant = typeof quoteParticipants.$inferSelect;
export type NewQuoteParticipant = typeof quoteParticipants.$inferInsert;
export type QuoteOption = typeof quoteOptions.$inferSelect;
export type NewQuoteOption = typeof quoteOptions.$inferInsert;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type NewQuoteLineItem = typeof quoteLineItems.$inferInsert;
export type QuoteAcceptance = typeof quoteAcceptances.$inferSelect;
export type NewQuoteAcceptance = typeof quoteAcceptances.$inferInsert;

export type Crew = typeof crews.$inferSelect;
export type NewCrew = typeof crews.$inferInsert;

export type CrewAvailability = typeof crewAvailability.$inferSelect;
export type NewCrewAvailability = typeof crewAvailability.$inferInsert;

export type CrewFeedbackSummary = typeof crewFeedbackSummary.$inferSelect;
export type NewCrewFeedbackSummary = typeof crewFeedbackSummary.$inferInsert;

export type Shoot = typeof shoots.$inferSelect;
export type NewShoot = typeof shoots.$inferInsert;

export type ShootAssignment = typeof shootAssignments.$inferSelect;
export type NewShootAssignment = typeof shootAssignments.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskAssignment = typeof taskAssignments.$inferSelect;
export type NewTaskAssignment = typeof taskAssignments.$inferInsert;

export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;

export type DeliverableAssignment = typeof deliverableAssignments.$inferSelect;
export type NewDeliverableAssignment =
	typeof deliverableAssignments.$inferInsert;

export type DeliverableTaskLink = typeof deliverableTaskLinks.$inferSelect;
export type NewDeliverableTaskLink = typeof deliverableTaskLinks.$inferInsert;

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type NewAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

export type SubmissionFile = typeof submissionFiles.$inferSelect;
export type NewSubmissionFile = typeof submissionFiles.$inferInsert;

export type SubmissionFeedback = typeof submissionFeedback.$inferSelect;
export type NewSubmissionFeedback = typeof submissionFeedback.$inferInsert;

export type ReceivedAmount = typeof receivedAmounts.$inferSelect;
export type NewReceivedAmount = typeof receivedAmounts.$inferInsert;

export type PaymentSchedule = typeof paymentSchedules.$inferSelect;
export type NewPaymentSchedule = typeof paymentSchedules.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type ExpenseAssignment = typeof expenseAssignments.$inferSelect;
export type NewExpenseAssignment = typeof expenseAssignments.$inferInsert;

export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

export type SavedView = typeof savedViews.$inferSelect;
export type NewSavedView = typeof savedViews.$inferInsert;

export type SavedViewFavorite = typeof savedViewFavorites.$inferSelect;
export type NewSavedViewFavorite = typeof savedViewFavorites.$inferInsert;

export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationPreference =
	typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
	typeof notificationPreferences.$inferInsert;
