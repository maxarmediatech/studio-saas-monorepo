import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const waEvents = pgTable(
	"wa_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		providerEventId: text("provider_event_id").notNull(),
		eventType: text("event_type").notNull(),
		payload: jsonb("payload"),
		processingStatus: text("processing_status")
			.notNull()
			.default("pending"),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(10),
		lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		lockedBy: text("locked_by"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_events_organization_id_idx").on(table.organizationId),
		index("wa_events_account_id_idx").on(table.accountId),
		index("wa_events_due_idx").on(
			table.processingStatus,
			table.nextAttemptAt,
		),
		uniqueIndex("wa_events_idempotency_idx").on(
			table.accountId,
			table.providerEventId,
		),
	],
);
