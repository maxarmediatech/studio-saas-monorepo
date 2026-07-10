import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { waOutboxStatusEnum } from "./enums";

export const waOutbox = pgTable(
	"wa_outbox",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		messageId: varchar("message_id", { length: 255 }).notNull(),
		status: waOutboxStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").default(0),
		maxAttempts: integer("max_attempts").default(3),
		lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
		lockedBy: text("locked_by"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		dispatchStartedAt: timestamp("dispatch_started_at", {
			withTimezone: true,
		}),
		errorMessage: text("error_message"),
		priority: integer("priority").default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_outbox_organization_id_idx").on(table.organizationId),
		index("wa_outbox_account_id_idx").on(table.accountId),
		uniqueIndex("wa_outbox_message_id_idx").on(table.messageId),
		index("wa_outbox_status_idx").on(table.status),
		index("wa_outbox_next_attempt_idx").on(table.nextAttemptAt),
		index("wa_outbox_lease_expiry_idx").on(table.leaseExpiresAt),
		index("wa_outbox_queue_idx").on(
			table.status,
			table.nextAttemptAt,
			table.priority,
		),
	],
);
