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

export const waTemplates = pgTable(
	"wa_templates",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		providerTemplateId: text("provider_template_id"),
		name: text("name").notNull(),
		language: text("language").notNull(),
		status: text("status").notNull(),
		category: text("category").notNull(),
		components: jsonb("components"),
		rejectedReason: text("rejected_reason"),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_templates_organization_id_idx").on(table.organizationId),
		index("wa_templates_account_id_idx").on(table.accountId),
		index("wa_templates_status_idx").on(table.status),
		index("wa_templates_language_idx").on(table.language),
		uniqueIndex("wa_templates_account_name_language_uidx").on(
			table.accountId,
			table.name,
			table.language,
		),
	],
);
