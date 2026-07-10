import { pgEnum } from "drizzle-orm/pg-core";

export const waProviderEnum = pgEnum("wa_provider", ["baileys", "cloud_api"]);

export const waConnectionStatusEnum = pgEnum("wa_connection_status", [
	"disconnected",
	"connecting",
	"qr_pending",
	"connected",
	"banned",
]);

export const waOwnershipTypeEnum = pgEnum("wa_ownership_type", [
	"platform",
	"customer",
]);

export const waMessageTypeEnum = pgEnum("wa_message_type", [
	"text",
	"image",
	"video",
	"audio",
	"document",
	"sticker",
	"location",
	"contact",
	"template",
	"interactive",
]);

export const waMessageDirectionEnum = pgEnum("wa_message_direction", [
	"inbound",
	"outbound",
]);

export const waMessageStatusEnum = pgEnum("wa_message_status", [
	"pending",
	"queued",
	"sent",
	"delivered",
	"read",
	"failed",
]);

export const waConversationStatusEnum = pgEnum("wa_conversation_status", [
	"open",
	"closed",
	"archived",
]);

export const waOutboxStatusEnum = pgEnum("wa_outbox_status", [
	"pending",
	"processing",
	"sent",
	"failed",
]);

export const waMediaStorageTypeEnum = pgEnum("wa_media_storage_type", [
	"local",
	"s3",
	"provider",
]);

export const waMediaIngestStatusEnum = pgEnum("wa_media_ingest_status", [
	"pending",
	"processing",
	"ready",
	"failed",
]);

export const waCampaignStatusEnum = pgEnum("wa_campaign_status", [
	"draft",
	"scheduled",
	"running",
	"paused",
	"completed",
	"cancelled",
]);

export const waBotFlowStatusEnum = pgEnum("wa_bot_flow_status", [
	"draft",
	"published",
	"archived",
]);
