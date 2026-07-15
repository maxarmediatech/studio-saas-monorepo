import { sql } from "drizzle-orm";
import {
	check,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

/**
 * Durable claim for a manually accepted WhatsApp send.
 *
 * A processing row is never intentionally committed: the claim, message,
 * outbox row, and completion update share one database transaction.
 */
export const waManualSendIdempotency = pgTable(
	"wa_manual_send_idempotency",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		actorId: text("actor_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		idempotencyKey: varchar("idempotency_key", { length: 128 }).notNull(),
		requestFingerprint: varchar("request_fingerprint", {
			length: 64,
		}).notNull(),
		status: varchar("status", { length: 20 })
			.default("processing")
			.notNull(),
		messageId: varchar("message_id", { length: 255 }),
		outboxId: varchar("outbox_id", { length: 255 }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("wa_manual_send_idempotency_scope_key_idx").on(
			table.organizationId,
			table.actorId,
			table.accountId,
			table.idempotencyKey,
		),
		index("wa_manual_send_idempotency_message_idx").on(table.messageId),
		index("wa_manual_send_idempotency_outbox_idx").on(table.outboxId),
		check(
			"wa_manual_send_idempotency_status_check",
			sql`status IN ('processing', 'completed')`,
		),
		check(
			"wa_manual_send_idempotency_completion_check",
			sql`(status = 'processing' AND message_id IS NULL AND outbox_id IS NULL AND completed_at IS NULL) OR (status = 'completed' AND message_id IS NOT NULL AND outbox_id IS NOT NULL AND completed_at IS NOT NULL)`,
		),
	],
);
