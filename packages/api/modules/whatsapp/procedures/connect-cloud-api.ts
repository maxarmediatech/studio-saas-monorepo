import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	encryptWhatsAppSecret,
	hashWebhookVerifyToken,
} from "../lib/account-secrets";
import { validateCloudApiAccount } from "../lib/cloud-api-admin";
import {
	connectCloudApiInputSchema,
	connectCloudApiOutputSchema,
} from "../types";

export const connectCloudApi = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/connect-cloud-api",
		tags: ["WhatsApp"],
		summary: "Connect WhatsApp Cloud API",
	})
	.input(connectCloudApiInputSchema)
	.output(connectCloudApiOutputSchema)
	.handler(async ({ input, context }) => {
		const existing = await db.query.waAccounts.findFirst({
			where: and(
				eq(waAccounts.organizationId, context.organizationId),
				eq(waAccounts.phoneNumberId, input.phoneNumberId),
				isNull(waAccounts.deletedAt),
			),
		});

		if (existing) {
			throw new ORPCError("CONFLICT", {
				message:
					"A WhatsApp account with this phone number already exists",
			});
		}

		const validation = await validateCloudApiAccount({
			accessToken: input.accessToken,
			phoneNumberId: input.phoneNumberId,
			wabaId: input.wabaId ?? null,
			apiVersion: input.apiVersion,
		}).catch((error) => {
			throw new ORPCError("BAD_REQUEST", {
				message:
					error instanceof Error
						? error.message
						: "Failed to validate WhatsApp Cloud API credentials",
			});
		});

		const now = new Date();
		const [created] = await db
			.insert(waAccounts)
			.values({
				organizationId: context.organizationId,
				name: input.name,
				phoneNumber: validation.displayPhoneNumber,
				displayPhoneNumber: validation.displayPhoneNumber,
				provider: "cloud_api",
				connectionStatus: "connected",
				ownershipType: "customer",
				apiVersion: validation.apiVersion,
				phoneNumberId: input.phoneNumberId,
				wabaId: input.wabaId ?? null,
				accessToken: encryptWhatsAppSecret(input.accessToken),
				appSecret: input.appSecret
					? encryptWhatsAppSecret(input.appSecret)
					: null,
				webhookVerifyToken: hashWebhookVerifyToken(
					input.webhookVerifyToken,
				),
				verifiedName: validation.verifiedName,
				qualityRating: validation.qualityRating,
				messagingLimitTier: validation.messagingLimitTier,
				lastConnectedAt: now,
				lastValidatedAt: now,
			})
			.returning({ id: waAccounts.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create WhatsApp account",
			});
		}

		return {
			data: { id: created.id },
			message: "WhatsApp account created",
		};
	});
