import {
	boolean,
	index,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";

export const waContacts = pgTable(
	"wa_contacts",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		waId: text("wa_id").notNull(),
		phoneNumber: text("phone_number").notNull(),
		pushName: text("push_name"),
		name: text("name"),
		email: text("email"),
		tags: jsonb("tags").$type<string[]>().default([]),
		customFields: jsonb("custom_fields").$type<Record<string, unknown>>(),
		assignedToUserId: text("assigned_to_user_id"),
		externalSource: text("external_source"),
		externalId: text("external_id"),
		isBlocked: boolean("is_blocked").default(false),
		isOptedOut: boolean("is_opted_out").default(false),
		lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_contacts_organization_id_idx").on(table.organizationId),
		index("wa_contacts_account_id_idx").on(table.accountId),
		index("wa_contacts_wa_id_idx").on(table.waId),
		index("wa_contacts_phone_number_idx").on(table.phoneNumber),
		uniqueIndex("wa_contacts_account_wa_id_idx").on(
			table.accountId,
			table.waId,
		),
		uniqueIndex("wa_contacts_external_link_idx").on(
			table.organizationId,
			table.externalSource,
			table.externalId,
		),
	],
);
