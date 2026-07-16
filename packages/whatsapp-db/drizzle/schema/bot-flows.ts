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
	waAutomationActionStatusEnum,
	waAutomationRunStatusEnum,
	waBotFlowStatusEnum,
} from "./enums";

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

export const waAutomationRuns = pgTable(
	"wa_automation_runs",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		accountId: varchar("account_id", { length: 255 }).notNull(),
		flowId: varchar("flow_id", { length: 255 }).notNull(),
		triggerIdentity: text("trigger_identity").notNull(),
		inboundMessageId: varchar("inbound_message_id", {
			length: 255,
		}).notNull(),
		contactId: varchar("contact_id", { length: 255 }).notNull(),
		conversationId: varchar("conversation_id", { length: 255 }).notNull(),
		flowVersion: integer("flow_version").notNull(),
		actionSnapshot: jsonb("action_snapshot").notNull(),
		status: waAutomationRunStatusEnum("status")
			.notNull()
			.default("pending"),
		currentActionIndex: integer("current_action_index")
			.notNull()
			.default(0),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
		lockedBy: text("locked_by"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		lastError: text("last_error"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("wa_automation_runs_trigger_identity_idx").on(
			table.flowId,
			table.triggerIdentity,
		),
		index("wa_automation_runs_queue_idx").on(
			table.status,
			table.nextAttemptAt,
		),
		index("wa_automation_runs_lease_idx").on(table.leaseExpiresAt),
	],
);

export const waAutomationActions = pgTable(
	"wa_automation_actions",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		runId: varchar("run_id", { length: 255 }).notNull(),
		flowId: varchar("flow_id", { length: 255 }).notNull(),
		actionIndex: integer("action_index").notNull(),
		type: text("type").notNull(),
		payload: jsonb("payload").notNull(),
		status: waAutomationActionStatusEnum("status")
			.notNull()
			.default("pending"),
		attempts: integer("attempts").notNull().default(0),
		maxAttempts: integer("max_attempts").notNull().default(5),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
		lockedBy: text("locked_by"),
		leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
		waitUntil: timestamp("wait_until", { withTimezone: true }),
		messageId: varchar("message_id", { length: 255 }),
		lastError: text("last_error"),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("wa_automation_actions_run_index_idx").on(
			table.runId,
			table.actionIndex,
		),
		uniqueIndex("wa_automation_actions_message_idx").on(table.messageId),
		index("wa_automation_actions_queue_idx").on(
			table.status,
			table.nextAttemptAt,
			table.waitUntil,
		),
		index("wa_automation_actions_lease_idx").on(table.leaseExpiresAt),
	],
);
