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
import {
	waConnectionStatusEnum,
	waOwnershipTypeEnum,
	waProviderEnum,
} from "./enums";

export const waAccounts = pgTable(
	"wa_accounts",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		name: text("name").notNull(),
		phoneNumber: text("phone_number"),
		displayPhoneNumber: text("display_phone_number"),
		provider: waProviderEnum("provider").notNull(),
		connectionStatus: waConnectionStatusEnum("connection_status")
			.notNull()
			.default("disconnected"),
		ownershipType: waOwnershipTypeEnum("ownership_type")
			.notNull()
			.default("platform"),
		sessionKey: text("session_key"),
		sessionData: jsonb("session_data"),
		qrCode: text("qr_code"),
		qrExpiresAt: timestamp("qr_expires_at", { withTimezone: true }),
		apiVersion: text("api_version"),
		wabaId: text("waba_id"),
		phoneNumberId: text("phone_number_id"),
		accessToken: text("access_token"),
		appSecret: text("app_secret"),
		webhookVerifyToken: text("webhook_verify_token"),
		verifiedName: text("verified_name"),
		qualityRating: text("quality_rating"),
		messagingLimitTier: text("messaging_limit_tier"),
		lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
		lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }),
		lastEventAt: timestamp("last_event_at", { withTimezone: true }),
		lastErrorMessage: text("last_error_message"),
		errorCount: integer("error_count").default(0),
		webhookUrl: text("webhook_url"),
		settings: jsonb("settings"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }),
	},
	(table) => [
		index("wa_accounts_organization_id_idx").on(table.organizationId),
		index("wa_accounts_session_key_idx").on(table.sessionKey),
		index("wa_accounts_provider_idx").on(table.provider),
		index("wa_accounts_connection_status_idx").on(table.connectionStatus),
	],
);
