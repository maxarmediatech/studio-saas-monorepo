import {
	index,
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
		processedAt: timestamp("processed_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_events_organization_id_idx").on(table.organizationId),
		index("wa_events_account_id_idx").on(table.accountId),
		uniqueIndex("wa_events_idempotency_idx").on(
			table.accountId,
			table.providerEventId,
		),
	],
);
