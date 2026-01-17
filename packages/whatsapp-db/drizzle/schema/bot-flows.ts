import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { waBotFlowStatusEnum } from "./enums";

export const waBotFlows = pgTable(
	"wa_bot_flows",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		name: text("name").notNull(),
		description: text("description"),
		status: waBotFlowStatusEnum("status").notNull().default("draft"),
		schemaVersion: integer("schema_version").notNull().default(1),
		flowData: jsonb("flow_data"),
		triggerType: text("trigger_type").notNull().default("keyword"),
		triggerKeywords: jsonb("trigger_keywords").default([]),
		totalTriggered: integer("total_triggered").default(0),
		lastTriggeredAt: timestamp("last_triggered_at", { withTimezone: true }),
		createdByUserId: text("created_by_user_id"),
		publishedAt: timestamp("published_at", { withTimezone: true }),
		publishedVersion: integer("published_version"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_bot_flows_organization_id_idx").on(table.organizationId),
		index("wa_bot_flows_account_id_idx").on(table.accountId),
		index("wa_bot_flows_status_idx").on(table.status),
	],
);
