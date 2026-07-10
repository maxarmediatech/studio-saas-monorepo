import { ORPCError } from "@orpc/server";
import { and, db, eq, isNull, ne } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toWhatsAppAccountSummary } from "../lib/account-presenter";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import {
	decryptWhatsAppSecret,
	encryptWhatsAppSecret,
	hashWebhookVerifyToken,
} from "../lib/account-secrets";
import { validateCloudApiAccount } from "../lib/cloud-api-admin";
import { updateAccountInputSchema, updateAccountOutputSchema } from "../types";

export const updateAccount = studioProtectedProcedure
	.route({
		method: "PATCH",
		path: "/whatsapp/accounts/:accountId",
		tags: ["WhatsApp"],
		summary: "Update WhatsApp account",
	})
	.input(updateAccountInputSchema)
	.output(updateAccountOutputSchema)
	.handler(async ({ input, context }) => {
		const account = await findActiveWhatsAppAccount(
			context.organizationId,
			input.accountId,
		);

		if (!account) {
			throw new ORPCError("NOT_FOUND", {
				message: "WhatsApp account not found",
			});
		}

		const nextPhoneNumberId = input.phoneNumberId ?? account.phoneNumberId;
		const nextWabaId = input.wabaId ?? account.wabaId;
		const nextApiVersion = input.apiVersion ?? account.apiVersion;
		const nextAccessToken =
			input.accessToken ?? decryptWhatsAppSecret(account.accessToken);

		if (nextPhoneNumberId) {
			const duplicate = await db.query.waAccounts.findFirst({
				where: and(
					eq(waAccounts.organizationId, context.organizationId),
					eq(waAccounts.phoneNumberId, nextPhoneNumberId),
					ne(waAccounts.id, account.id),
					isNull(waAccounts.deletedAt),
				),
			});

			if (duplicate) {
				throw new ORPCError("CONFLICT", {
					message:
						"Another WhatsApp account already uses this phone number",
				});
			}
		}

		let validation: Awaited<
			ReturnType<typeof validateCloudApiAccount>
		> | null = null;

		if (
			account.provider === "cloud_api" &&
			nextPhoneNumberId &&
			nextAccessToken
		) {
			validation = await validateCloudApiAccount({
				accessToken: nextAccessToken,
				phoneNumberId: nextPhoneNumberId,
				wabaId: nextWabaId,
				apiVersion: nextApiVersion,
			}).catch((error) => {
				throw new ORPCError("BAD_REQUEST", {
					message:
						error instanceof Error
							? error.message
							: "Failed to validate WhatsApp account",
				});
			});
		}

		const [updated] = await db
			.update(waAccounts)
			.set({
				name: input.name ?? account.name,
				apiVersion: validation?.apiVersion ?? nextApiVersion ?? null,
				phoneNumberId: nextPhoneNumberId,
				wabaId: nextWabaId,
				accessToken: input.accessToken
					? encryptWhatsAppSecret(input.accessToken)
					: account.accessToken,
				appSecret: input.appSecret
					? encryptWhatsAppSecret(input.appSecret)
					: account.appSecret,
				webhookVerifyToken: input.webhookVerifyToken
					? hashWebhookVerifyToken(input.webhookVerifyToken)
					: account.webhookVerifyToken,
				phoneNumber:
					validation?.displayPhoneNumber ??
					account.phoneNumber ??
					null,
				displayPhoneNumber:
					validation?.displayPhoneNumber ??
					account.displayPhoneNumber ??
					null,
				verifiedName:
					validation?.verifiedName ?? account.verifiedName ?? null,
				qualityRating:
					validation?.qualityRating ?? account.qualityRating ?? null,
				messagingLimitTier:
					validation?.messagingLimitTier ??
					account.messagingLimitTier ??
					null,
				lastValidatedAt: validation
					? new Date()
					: account.lastValidatedAt,
				lastErrorMessage: null,
			})
			.where(eq(waAccounts.id, account.id))
			.returning();

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update WhatsApp account",
			});
		}

		return {
			data: toWhatsAppAccountSummary(updated),
			message: "WhatsApp account updated",
		};
	});
