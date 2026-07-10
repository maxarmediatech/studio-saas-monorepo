import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { v7 as uuidv7 } from "uuid";
import { waMediaIngestStatusEnum, waMediaStorageTypeEnum } from "./enums";

export const waMedia = pgTable(
	"wa_media",
	{
		id: varchar("id", { length: 255 })
			.$defaultFn(() => uuidv7())
			.primaryKey(),
		organizationId: text("organization_id").notNull(),
		providerMediaId: text("provider_media_id"),
		mimeType: text("mime_type").notNull(),
		fileName: text("file_name"),
		fileSize: integer("file_size"),
		width: integer("width"),
		height: integer("height"),
		duration: integer("duration"),
		storageType: waMediaStorageTypeEnum("storage_type")
			.notNull()
			.default("s3"),
		ingestStatus: waMediaIngestStatusEnum("ingest_status")
			.notNull()
			.default("ready"),
		ingestAttempts: integer("ingest_attempts").notNull().default(0),
		lastIngestAttemptAt: timestamp("last_ingest_attempt_at", {
			withTimezone: true,
		}),
		nextIngestAttemptAt: timestamp("next_ingest_attempt_at", {
			withTimezone: true,
		}),
		ingestErrorMessage: text("ingest_error_message"),
		storageUrl: text("storage_url"),
		thumbnailUrl: text("thumbnail_url"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("wa_media_organization_id_idx").on(table.organizationId),
		index("wa_media_provider_media_id_idx").on(table.providerMediaId),
	],
);
