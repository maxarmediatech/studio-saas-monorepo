import { relations } from "drizzle-orm";
import {
	boolean,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { users } from "./auth";
import { purchaseTypeEnum } from "./enums";
import { organizations } from "./organizations";

// ============================================================================
// BILLING TABLES
// SaaS subscription and payment management from NebulaForge
// ============================================================================

export const purchases = pgTable("purchases", {
	id: varchar("id", { length: 255 })
		.$defaultFn(() => uuidv7())
		.primaryKey(),
	organizationId: text("organization_id").references(() => organizations.id, {
		onDelete: "cascade",
	}),
	userId: text("user_id").references(() => users.id, {
		onDelete: "cascade",
	}),
	type: purchaseTypeEnum("type").notNull(),
	customerId: text("customer_id").notNull(),
	subscriptionId: text("subscription_id").unique(),
	paymentId: text("payment_id").unique(),
	productId: text("product_id").notNull(),
	status: text("status"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const webhookEvents = pgTable(
	"webhook_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		webhookId: text("webhook_id").notNull(),
		eventType: text("event_type").notNull(),
		payload: text("payload").notNull(),
		processed: boolean("processed").default(false).notNull(),
		processedAt: timestamp("processed_at", { withTimezone: true }),
		errorMessage: text("error_message"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("webhook_events_webhook_id_idx").on(table.webhookId),
	],
);

// ============================================================================
// BILLING RELATIONS
// ============================================================================

export const purchaseRelations = relations(purchases, ({ one }) => ({
	organization: one(organizations, {
		fields: [purchases.organizationId],
		references: [organizations.id],
	}),
	user: one(users, {
		fields: [purchases.userId],
		references: [users.id],
	}),
}));
