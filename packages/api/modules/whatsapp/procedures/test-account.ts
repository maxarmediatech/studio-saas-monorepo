import { ORPCError } from "@orpc/server";
import { db, eq } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { toWhatsAppAccountSummary } from "../lib/account-presenter";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { decryptWhatsAppSecret } from "../lib/account-secrets";
import { validateCloudApiAccount } from "../lib/cloud-api-admin";
import { testAccountInputSchema, testAccountOutputSchema } from "../types";

export const testAccount = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/:accountId/test",
		tags: ["WhatsApp"],
		summary: "Validate WhatsApp Cloud API account credentials",
	})
	.input(testAccountInputSchema)
	.output(testAccountOutputSchema)
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

		if (account.provider !== "cloud_api") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only Cloud API accounts can be tested right now",
			});
		}

		const accessToken = decryptWhatsAppSecret(account.accessToken);
		if (!accessToken || !account.phoneNumberId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Account is missing Cloud API credentials",
			});
		}

		const validation = await validateCloudApiAccount({
			accessToken,
			phoneNumberId: account.phoneNumberId,
			wabaId: account.wabaId,
			apiVersion: account.apiVersion,
		}).catch(async (error) => {
			const message =
				error instanceof Error
					? error.message
					: "Failed to validate WhatsApp account";

			await db
				.update(waAccounts)
				.set({
					lastErrorMessage: message,
				})
				.where(eq(waAccounts.id, account.id));

			throw new ORPCError("BAD_REQUEST", {
				message,
			});
		});

		const [updated] = await db
			.update(waAccounts)
			.set({
				apiVersion: validation.apiVersion,
				phoneNumber: validation.displayPhoneNumber,
				displayPhoneNumber: validation.displayPhoneNumber,
				verifiedName: validation.verifiedName,
				qualityRating: validation.qualityRating,
				messagingLimitTier: validation.messagingLimitTier,
				lastValidatedAt: new Date(),
				lastErrorMessage: null,
			})
			.where(eq(waAccounts.id, account.id))
			.returning();

		if (!updated) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to update WhatsApp account validation state",
			});
		}

		return {
			data: toWhatsAppAccountSummary(updated),
			message: "WhatsApp account validated",
		};
	});
