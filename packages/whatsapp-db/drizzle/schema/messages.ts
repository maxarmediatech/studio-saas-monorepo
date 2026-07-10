import {
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import {
	waMessageDirectionEnum,
	waMessageStatusEnum,
	waMessageTypeEnum,
} from "./enums";

export const waMessages = pgTable(
	"wa_messages",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		conversationId: varchar("conversation_id", { length: 255 }).notNull(),
		contactId: varchar("contact_id", { length: 255 }).notNull(),
		providerMessageId: text("provider_message_id"),
		providerTimestamp: timestamp("provider_timestamp", {
			withTimezone: true,
		}),
		direction: waMessageDirectionEnum("direction").notNull(),
		type: waMessageTypeEnum("type").notNull(),
		textBody: text("text_body"),
		caption: text("caption"),
		mediaId: varchar("media_id", { length: 255 }),
		templateName: text("template_name"),
		templateParams: jsonb("template_params"),
		interactiveData: jsonb("interactive_data"),
		status: waMessageStatusEnum("status").notNull().default("pending"),
		statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true }),
		errorCode: text("error_code"),
		errorMessage: text("error_message"),
		sentByUserId: text("sent_by_user_id"),
		sentByBotFlowId: varchar("sent_by_bot_flow_id", { length: 255 }),
		sentByCampaignId: varchar("sent_by_campaign_id", { length: 255 }),
		rawPayload: jsonb("raw_payload"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_messages_organization_id_idx").on(table.organizationId),
		index("wa_messages_account_id_idx").on(table.accountId),
		index("wa_messages_conversation_id_idx").on(table.conversationId),
		index("wa_messages_contact_id_idx").on(table.contactId),
		index("wa_messages_provider_message_id_idx").on(
			table.providerMessageId,
		),
		index("wa_messages_created_at_idx").on(table.createdAt),
		index("wa_messages_status_idx").on(table.status),
		index("wa_messages_sent_by_campaign_id_idx").on(table.sentByCampaignId),
	],
);
