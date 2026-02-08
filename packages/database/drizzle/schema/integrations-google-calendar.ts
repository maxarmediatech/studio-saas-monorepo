import { relations } from "drizzle-orm";
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
import { users } from "./auth";
import { organizations } from "./core";
import {
	calendarDeliveryMethodEnum,
	calendarEventSyncStatusEnum,
	calendarJobStatusEnum,
	calendarJobTypeEnum,
} from "./enums";
import { crews, shoots } from "./studio";

// =========================================================================
// Google Calendar Integration (per user) + iCalendar fallback (per email)
// =========================================================================

export const googleCalendarConnections = pgTable(
	"google_calendar_connections",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		userId: varchar("user_id", { length: 255 })
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),

		// Display-only metadata
		googleAccountEmail: text("google_account_email"),

		// OAuth tokens (encrypt at rest at the application layer)
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		scope: text("scope"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),

		connectedAt: timestamp("connected_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("google_calendar_connections_org_user_idx").on(
			table.organizationId,
			table.userId,
		),
		index("google_calendar_connections_org_idx").on(table.organizationId),
		index("google_calendar_connections_user_idx").on(table.userId),
	],
);

export const shootCalendarEvents = pgTable(
	"shoot_calendar_events",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),
		shootId: varchar("shoot_id", { length: 255 })
			.notNull()
			.references(() => shoots.id, { onDelete: "cascade" }),
		crewId: varchar("crew_id", { length: 255 })
			.notNull()
			.references(() => crews.id, { onDelete: "cascade" }),

		deliveryMethod: calendarDeliveryMethodEnum("delivery_method")
			.notNull()
			.default("google"),

		// Google event mapping (for deliveryMethod=google)
		calendarId: text("calendar_id"),
		googleEventId: text("google_event_id"),

		// iCalendar mapping (for deliveryMethod=ics)
		icalUid: text("ical_uid"),
		icalSequence: integer("ical_sequence").default(0).notNull(),
		recipientEmail: text("recipient_email"),

		syncStatus: calendarEventSyncStatusEnum("sync_status")
			.notNull()
			.default("pending"),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		lastError: text("last_error"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		uniqueIndex("shoot_calendar_events_shoot_crew_idx").on(
			table.shootId,
			table.crewId,
		),
		index("shoot_calendar_events_org_idx").on(table.organizationId),
		index("shoot_calendar_events_shoot_idx").on(table.shootId),
		index("shoot_calendar_events_crew_idx").on(table.crewId),
		index("shoot_calendar_events_status_idx").on(table.syncStatus),
	],
);

export const calendarSyncJobs = pgTable(
	"calendar_sync_jobs",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: varchar("organization_id", { length: 255 })
			.notNull()
			.references(() => organizations.id, { onDelete: "cascade" }),

		status: calendarJobStatusEnum("status").notNull().default("pending"),
		jobType: calendarJobTypeEnum("job_type").notNull(),
		payload: jsonb("payload"),

		shootId: varchar("shoot_id", { length: 255 }).references(
			() => shoots.id,
			{
				onDelete: "cascade",
			},
		),
		crewId: varchar("crew_id", { length: 255 }).references(() => crews.id, {
			onDelete: "cascade",
		}),

		attempts: integer("attempts").default(0),
		maxAttempts: integer("max_attempts").default(5),
		lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
		nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
		lockedAt: timestamp("locked_at", { withTimezone: true }),
		lastError: text("last_error"),

		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("calendar_sync_jobs_org_idx").on(table.organizationId),
		index("calendar_sync_jobs_status_idx").on(table.status),
		index("calendar_sync_jobs_next_attempt_idx").on(table.nextAttemptAt),
		index("calendar_sync_jobs_queue_idx").on(
			table.status,
			table.nextAttemptAt,
		),
		index("calendar_sync_jobs_target_idx").on(table.shootId, table.crewId),
	],
);

// =========================================================================
// Relations (optional, used by db.query.* helpers)
// =========================================================================

export const googleCalendarConnectionRelations = relations(
	googleCalendarConnections,
	({ one }) => ({
		organization: one(organizations, {
			fields: [googleCalendarConnections.organizationId],
			references: [organizations.id],
		}),
		user: one(users, {
			fields: [googleCalendarConnections.userId],
			references: [users.id],
		}),
	}),
);

export const shootCalendarEventRelations = relations(
	shootCalendarEvents,
	({ one }) => ({
		organization: one(organizations, {
			fields: [shootCalendarEvents.organizationId],
			references: [organizations.id],
		}),
		shoot: one(shoots, {
			fields: [shootCalendarEvents.shootId],
			references: [shoots.id],
		}),
		crew: one(crews, {
			fields: [shootCalendarEvents.crewId],
			references: [crews.id],
		}),
	}),
);

export const calendarSyncJobRelations = relations(
	calendarSyncJobs,
	({ one }) => ({
		organization: one(organizations, {
			fields: [calendarSyncJobs.organizationId],
			references: [organizations.id],
		}),
		shoot: one(shoots, {
			fields: [calendarSyncJobs.shootId],
			references: [shoots.id],
		}),
		crew: one(crews, {
			fields: [calendarSyncJobs.crewId],
			references: [crews.id],
		}),
	}),
);
