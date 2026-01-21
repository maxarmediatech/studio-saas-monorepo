ALTER TABLE "channels" DROP COLUMN "emoji";--> statement-breakpoint
ALTER TABLE "channels" DROP COLUMN "visibility";--> statement-breakpoint
DROP TYPE "public"."channel_visibility";