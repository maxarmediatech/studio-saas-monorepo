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
import {
	waCampaignRecipientStatusEnum,
	waCampaignStatusEnum,
	waMessageTypeEnum,
} from "./enums";

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
		audienceCapturedAt: timestamp("audience_captured_at", {
			withTimezone: true,
		}),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		totalSent: integer("total_sent").default(0),
		totalRecipients: integer("total_recipients").default(0),
		totalQueued: integer("total_queued").default(0),
		totalDelivered: integer("total_delivered").default(0),
		totalRead: integer("total_read").default(0),
		totalFailed: integer("total_failed").default(0),
		totalSuppressed: integer("total_suppressed").default(0),
		totalDeliveryUnknown: integer("total_delivery_unknown").default(0),
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

export const waCampaignRecipients = pgTable(
	"wa_campaign_recipients",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		campaignId: varchar("campaign_id", { length: 255 }).notNull(),
		contactId: varchar("contact_id", { length: 255 }).notNull(),
		messageId: varchar("message_id", { length: 255 }),
		status: waCampaignRecipientStatusEnum("status")
			.notNull()
			.default("pending"),
		queuedAt: timestamp("queued_at", { withTimezone: true }),
		sentAt: timestamp("sent_at", { withTimezone: true }),
		deliveredAt: timestamp("delivered_at", { withTimezone: true }),
		readAt: timestamp("read_at", { withTimezone: true }),
		failedAt: timestamp("failed_at", { withTimezone: true }),
		suppressedAt: timestamp("suppressed_at", { withTimezone: true }),
		deliveryUnknownAt: timestamp("delivery_unknown_at", {
			withTimezone: true,
		}),
		failureCode: text("failure_code"),
		failureMessage: text("failure_message"),
		suppressionReason: text("suppression_reason"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("wa_campaign_recipients_identity_idx").on(
			table.campaignId,
			table.accountId,
			table.contactId,
		),
		uniqueIndex("wa_campaign_recipients_message_idx").on(table.messageId),
		index("wa_campaign_recipients_campaign_status_idx").on(
			table.campaignId,
			table.status,
		),
		index("wa_campaign_recipients_account_idx").on(table.accountId),
	],
);
