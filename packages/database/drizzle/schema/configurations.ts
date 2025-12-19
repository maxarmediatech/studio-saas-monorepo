import { relations } from "drizzle-orm";
import {
	boolean,
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
import { configTypeEnum } from "./enums";
import { organizations } from "./organizations";

// ============================================================================
// CONFIGURATIONS TABLE
// Per-organization customizable settings (statuses, priorities, categories)
// ============================================================================

/**
 * Configurations - allows organization owners to customize:
 * - Task statuses (todo, in_progress, done, etc.)
 * - Task priorities (low, medium, high, urgent)
 * - Deliverable statuses
 * - Crew statuses
 * - Shoot statuses
 * - Booking types (wedding, corporate, etc.)
 * - Package types (gold, silver, etc.)
 * - Expense categories
 * - Relation types (bride, groom, etc.)
 *
 * Each organization can have their own set of values for each type.
 * System defaults are seeded when an organization is created.
 */
export const configurations = pgTable(
	"configurations",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		// Type and key identify the configuration
		type: configTypeEnum("type").notNull(),
		key: varchar("key", { length: 100 }).notNull(),

		// Display properties
		label: text("label").notNull(),
		description: text("description"),

		// UI customization
		color: varchar("color", { length: 20 }),
		icon: varchar("icon", { length: 50 }),
		sortOrder: integer("sort_order").default(0).notNull(),

		// Behavior flags
		isDefault: boolean("is_default").default(false).notNull(),
		isSystem: boolean("is_system").default(false).notNull(),

		// Additional configuration (e.g., allowed transitions, metadata)
		metadata: jsonb("metadata"),

		// Timestamps
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// Each org can only have one config with the same type+key
		uniqueIndex("configurations_org_type_key_idx").on(
			table.organizationId,
			table.type,
			table.key,
		),
		// Fast lookup by org + type
		index("configurations_org_type_idx").on(
			table.organizationId,
			table.type,
		),
	],
);

// ============================================================================
// CONFIGURATIONS RELATIONS
// ============================================================================

export const configurationsRelations = relations(configurations, ({ one }) => ({
	organization: one(organizations, {
		fields: [configurations.organizationId],
		references: [organizations.id],
	}),
}));

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type Configuration = typeof configurations.$inferSelect;
export type NewConfiguration = typeof configurations.$inferInsert;
