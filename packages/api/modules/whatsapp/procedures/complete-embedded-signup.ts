import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull } from "@repo/database";
import { env } from "@repo/env";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import {
	encryptWhatsAppSecret,
	hashWebhookVerifyToken,
} from "../lib/account-secrets";
import {
	exchangeEmbeddedSignupCode,
	subscribeCloudApiApp,
	validateCloudApiAccount,
} from "../lib/cloud-api-admin";
import {
	completeEmbeddedSignupInputSchema,
	completeEmbeddedSignupOutputSchema,
} from "../types";

const DEFAULT_CLOUD_API_VERSION = "v22.0";

const getRequiredMetaConfig = () => {
	const appId = env.NEXT_PUBLIC_META_APP_ID?.trim();
	const appSecret = env.META_APP_SECRET?.trim();
	const webhookVerifyToken = env.META_WEBHOOK_VERIFY_TOKEN?.trim();
	const apiVersion =
		env.META_GRAPH_VERSION?.trim() || DEFAULT_CLOUD_API_VERSION;

	if (!appId || !appSecret || !webhookVerifyToken) {
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Meta embedded signup is not configured. Set NEXT_PUBLIC_META_APP_ID, META_APP_SECRET, and META_WEBHOOK_VERIFY_TOKEN.",
		});
	}

	return { appId, appSecret, webhookVerifyToken, apiVersion };
};

export const completeEmbeddedSignup = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/embedded-signup/complete",
		tags: ["WhatsApp"],
		summary: "Complete WhatsApp embedded signup",
	})
	.input(completeEmbeddedSignupInputSchema)
	.output(completeEmbeddedSignupOutputSchema)
	.handler(async ({ input, context }) => {
		const meta = getRequiredMetaConfig();

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

		const token = await exchangeEmbeddedSignupCode({
			appId: meta.appId,
			appSecret: meta.appSecret,
			code: input.code,
			apiVersion: meta.apiVersion,
		}).catch((error) => {
			throw new ORPCError("BAD_REQUEST", {
				message:
					error instanceof Error
						? error.message
						: "Failed to exchange embedded signup code",
			});
		});

		const validation = await validateCloudApiAccount({
			accessToken: token.accessToken,
			phoneNumberId: input.phoneNumberId,
			wabaId: input.wabaId,
			apiVersion: meta.apiVersion,
		}).catch((error) => {
			throw new ORPCError("BAD_REQUEST", {
				message:
					error instanceof Error
						? error.message
						: "Failed to validate WhatsApp Cloud API credentials",
			});
		});

		await subscribeCloudApiApp({
			accessToken: token.accessToken,
			wabaId: input.wabaId,
			apiVersion: meta.apiVersion,
		}).catch((error) => {
			throw new ORPCError("BAD_REQUEST", {
				message:
					error instanceof Error
						? error.message
						: "Failed to subscribe WhatsApp account to webhook events",
			});
		});

		const now = new Date();
		const [created] = await db
			.insert(waAccounts)
			.values({
				organizationId: context.organizationId,
				name:
					input.accountName?.trim() ||
					validation.verifiedName ||
					validation.displayPhoneNumber ||
					"WhatsApp account",
				phoneNumber: validation.displayPhoneNumber,
				displayPhoneNumber: validation.displayPhoneNumber,
				provider: "cloud_api",
				connectionStatus: "connected",
				ownershipType: "customer",
				apiVersion: validation.apiVersion,
				phoneNumberId: input.phoneNumberId,
				wabaId: input.wabaId,
				accessToken: encryptWhatsAppSecret(token.accessToken),
				appSecret: encryptWhatsAppSecret(meta.appSecret),
				webhookVerifyToken: hashWebhookVerifyToken(
					meta.webhookVerifyToken,
				),
				verifiedName: validation.verifiedName,
				qualityRating: validation.qualityRating,
				messagingLimitTier: validation.messagingLimitTier,
				lastConnectedAt: now,
				lastValidatedAt: now,
				settings: {
					embeddedSignup: {
						businessId: input.businessId ?? null,
						tokenType: token.tokenType,
						expiresIn: token.expiresIn,
						completedAt: now.toISOString(),
					},
				},
			})
			.returning({ id: waAccounts.id });

		if (!created) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create WhatsApp account",
			});
		}

		return {
			data: { id: created.id },
			message: "WhatsApp account connected with Meta",
		};
	});
