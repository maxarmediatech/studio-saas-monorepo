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
import { waConversationStatusEnum } from "./enums";

export const waConversations = pgTable(
	"wa_conversations",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		contactId: varchar("contact_id", { length: 255 }).notNull(),
		status: waConversationStatusEnum("status").notNull().default("open"),
		unreadCount: integer("unread_count").default(0),
		assignedToUserId: text("assigned_to_user_id"),
		lastMessageId: varchar("last_message_id", { length: 255 }),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		lastMessagePreview: text("last_message_preview"),
		windowExpiresAt: timestamp("window_expires_at", { withTimezone: true }),
		metadata: jsonb("metadata").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_conversations_organization_id_idx").on(table.organizationId),
		index("wa_conversations_account_id_idx").on(table.accountId),
		index("wa_conversations_contact_id_idx").on(table.contactId),
		index("wa_conversations_status_idx").on(table.status),
		index("wa_conversations_last_message_at_idx").on(table.lastMessageAt),
		uniqueIndex("wa_conversations_account_contact_idx").on(
			table.accountId,
			table.contactId,
		),
	],
);
