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
	pgTable,
	text,
	time,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { invitations, members, organizations, purchases } from "./core";
import {
	billToEnum,
	bookingPhaseEnum,
	configTypeEnum,
	invoiceStatusEnum,
	paymentMethodEnum,
	paymentScheduleStatusEnum,
	submissionStatusEnum,
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
		metadata: jsonb("metadata"),

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
		index("clients_organization_idx").on(table.organizationId),
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

		bookingType: text("booking_type").notNull(),
		packageType: text("package_type").notNull(),
		packageCost: decimal("package_cost", { precision: 12, scale: 2 }).notNull(),

		status: bookingPhaseEnum("status").notNull().default("new"),

		totalReceived: decimal("total_received", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),
		totalExpenses: decimal("total_expenses", { precision: 12, scale: 2 })
			.default("0")
			.notNull(),

		note: text("note"),

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
		uniqueIndex("bookings_id_org_idx").on(table.id, table.organizationId),
		uniqueIndex("bookings_org_ref_idx")
			.on(table.organizationId, table.referenceNumber)
			.where(sql`deleted_at IS NULL`),
		index("bookings_org_status_idx").on(table.organizationId, table.status),
		index("bookings_org_created_idx").on(
			table.organizationId,
			table.createdAt,
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
		eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
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
		role: text("role").notNull(), // photographer, videographer, editor, etc.

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
		uniqueIndex("crew_availability_crew_date_idx").on(table.crewId, table.date),
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

		name: text("name").notNull(),
		shootType: text("shoot_type").notNull(), // pre-wedding, wedding, reception, etc.

		// Proper date and time types (not text!)
		shootDate: date("shoot_date").notNull(),
		startTime: time("start_time"),
		endTime: time("end_time"),

		venue: text("venue"),
		venueAddress: text("venue_address"),
		notes: text("notes"),

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

		assignedBy: varchar("assigned_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("task_assignments_task_crew_idx").on(table.taskId, table.crewId),
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
		deliverableType: text("deliverable_type").notNull(), // album, video, photos, etc.

		// Status is TEXT - configurable via configurations table (config_type: deliverable_status)
		status: text("status").default("pending").notNull(),
		// Priority is TEXT - configurable via configurations table (config_type: deliverable_priority)
		priority: text("priority").default("normal").notNull(),

		// Workflow status is ENUM - system-defined, cannot be customized
		workflowStatus: workflowStatusEnum("workflow_status")
			.default("not_started")
			.notNull(),

		dueDate: date("due_date"),
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
		index("deliverables_org_status_idx").on(table.organizationId, table.status),
		index("deliverables_org_workflow_idx").on(
			table.organizationId,
			table.workflowStatus,
		),
		index("deliverables_due_date_idx").on(table.dueDate),
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

		isLead: boolean("is_lead").default(false).notNull(),

		assignedBy: varchar("assigned_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
		createdAt: timestamp("created_at", { withTimezone: true })
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
		submittedAt: timestamp("submitted_at", { withTimezone: true }),

		reviewedBy: varchar("reviewed_by", { length: 255 }).references(
			() => users.id,
			{ onDelete: "set null" },
		),
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
			.references(() => assignmentSubmissions.id, { onDelete: "cascade" }),

		fileName: text("file_name").notNull(),
		fileUrl: text("file_url").notNull(),
		fileSize: integer("file_size"),
		mimeType: text("mime_type"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("submission_files_submission_idx").on(table.submissionId)],
);

export const submissionFeedback = pgTable(
	"submission_feedback",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		submissionId: varchar("submission_id", { length: 255 })
			.notNull()
			.references(() => assignmentSubmissions.id, { onDelete: "cascade" }),

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

		// Link to payment schedule if this fulfills a scheduled payment
		paymentScheduleId: varchar("payment_schedule_id", { length: 255 }).references(
			() => paymentSchedules.id,
			{ onDelete: "set null" },
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
	(table) => [
		index("received_amounts_org_idx").on(table.organizationId),
		index("received_amounts_booking_idx").on(table.bookingId),
		index("received_amounts_date_idx").on(table.receivedDate),
		index("received_amounts_schedule_idx").on(table.paymentScheduleId),
		check(
			"received_amounts_amount_positive",
			sql`amount > 0`,
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
		dueDate: date("due_date").notNull(),

		status: paymentScheduleStatusEnum("status").default("pending").notNull(),

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
		index("payment_schedules_due_date_idx").on(table.dueDate),
		index("payment_schedules_status_idx").on(table.status),
		check(
			"payment_schedules_amount_positive",
			sql`amount > 0`,
		),
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
		index("expenses_org_date_idx").on(table.organizationId, table.expenseDate),
		index("expenses_category_idx").on(table.category),
		index("expenses_bill_to_idx").on(table.billTo),
		check(
			"expenses_amount_positive",
			sql`amount > 0`,
		),
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
		shootId: varchar("shoot_id", { length: 255 }).references(() => shoots.id, {
			onDelete: "cascade",
		}),
		crewId: varchar("crew_id", { length: 255 }).references(() => crews.id, {
			onDelete: "cascade",
		}),

		// Percentage or fixed amount allocation
		allocationPercentage: decimal("allocation_percentage", {
			precision: 5,
			scale: 2,
		}),
		allocationAmount: decimal("allocation_amount", { precision: 12, scale: 2 }),

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

export const invoiceLineItems = pgTable(
	"invoice_line_items",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		invoiceId: varchar("invoice_id", { length: 255 })
			.notNull()
			.references(() => invoices.id, { onDelete: "cascade" }),

		description: text("description").notNull(),
		quantity: decimal("quantity", { precision: 10, scale: 2 })
			.default("1")
			.notNull(),
		unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
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
			"invoice_line_items_quantity_positive",
			sql`quantity > 0`,
		),
		check(
			"invoice_line_items_unit_price_non_negative",
			sql`unit_price >= 0`,
		),
		check(
			"invoice_line_items_amount_consistency",
			sql`amount = quantity * unit_price`,
		),
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
// RELATIONS
// All studio domain relations defined here
// ============================================================================

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

export const bookingEventRelations = relations(bookingEvents, ({ one }) => ({
	booking: one(bookings, {
		fields: [bookingEvents.bookingId],
		references: [bookings.id],
	}),
	organization: one(organizations, {
		fields: [bookingEvents.organizationId],
		references: [organizations.id],
	}),
}));

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

export const taskAssignmentRelations = relations(taskAssignments, ({ one }) => ({
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
}));

// ----------------------------------------------------------------------------
// Deliverable Relations
// ----------------------------------------------------------------------------

export const deliverableRelations = relations(deliverables, ({ one, many }) => ({
	organization: one(organizations, {
		fields: [deliverables.organizationId],
		references: [organizations.id],
	}),
	booking: one(bookings, {
		fields: [deliverables.bookingId],
		references: [bookings.id],
	}),
	assignments: many(deliverableAssignments),
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
}));

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

export const submissionFileRelations = relations(submissionFiles, ({ one }) => ({
	submission: one(assignmentSubmissions, {
		fields: [submissionFiles.submissionId],
		references: [assignmentSubmissions.id],
	}),
}));

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

export const receivedAmountRelations = relations(receivedAmounts, ({ one }) => ({
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
}));

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

// ----------------------------------------------------------------------------
// Organization Relations (includes all studio domain tables)
// ----------------------------------------------------------------------------

export const organizationRelations = relations(organizations, ({ many }) => ({
	members: many(members),
	invitations: many(invitations),
	purchases: many(purchases),
	configurations: many(configurations),
	clients: many(clients),
	bookings: many(bookings),
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
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

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
export type NewDeliverableAssignment = typeof deliverableAssignments.$inferInsert;

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
