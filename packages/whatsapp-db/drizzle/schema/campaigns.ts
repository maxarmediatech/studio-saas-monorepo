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
import { waCampaignStatusEnum, waMessageTypeEnum } from "./enums";

export const waCampaigns = pgTable(
	"wa_campaigns",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		name: text("name").notNull(),
		description: text("description"),
		status: waCampaignStatusEnum("status").notNull().default("draft"),
		messageType: waMessageTypeEnum("message_type")
			.notNull()
			.default("text"),
		textBody: text("text_body"),
		templateName: text("template_name"),
		templateParams: jsonb("template_params"),
		mediaId: varchar("media_id", { length: 255 }),
		audienceFilter: jsonb("audience_filter"),
		estimatedRecipients: integer("estimated_recipients").default(0),
		scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		totalSent: integer("total_sent").default(0),
		totalDelivered: integer("total_delivered").default(0),
		totalRead: integer("total_read").default(0),
		totalFailed: integer("total_failed").default(0),
		createdByUserId: text("created_by_user_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_campaigns_organization_id_idx").on(table.organizationId),
		index("wa_campaigns_account_id_idx").on(table.accountId),
		index("wa_campaigns_status_idx").on(table.status),
	],
);
