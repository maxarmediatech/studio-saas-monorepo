import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

// ============================================================================
// SMS STATUS ENUM
// Mirrors WhatsApp outbox status for consistency with worker expectations
// ============================================================================

export const smsStatusEnum = pgEnum("sms_status", [
	"pending",
	"processing",
	"sent",
	"failed",
]);

// ============================================================================
// SMS OUTBOX TABLE
// Queues SMS messages for delivery via SMS provider
// Mirrors WhatsApp outbox structure for consistency with worker patterns
// ============================================================================

export const smsOutbox = pgTable(
	"sms_outbox",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		phoneNumber: text("phone_number").notNull(), // E.164 format
		templateId: varchar("template_id", { length: 255 }).notNull(),
		variables: jsonb("variables"), // Template variables as JSON
		status: smsStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").default(0),
		maxAttempts: integer("max_attempts").default(3),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		providerMessageId: varchar("provider_message_id", { length: 255 }), // ID from SMS provider
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("sms_outbox_organization_id_idx").on(table.organizationId),
		index("sms_outbox_status_idx").on(table.status),
		index("sms_outbox_next_attempt_idx").on(table.nextAttemptAt),
		index("sms_outbox_queue_idx").on(table.status, table.nextAttemptAt),
	],
);
