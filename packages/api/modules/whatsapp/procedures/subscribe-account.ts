import { ORPCError } from "@orpc/server";
import { db, eq } from "@repo/database";
import { waAccounts } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { decryptWhatsAppSecret } from "../lib/account-secrets";
import { subscribeCloudApiApp } from "../lib/cloud-api-admin";
import {
	subscribeAccountInputSchema,
	subscribeAccountOutputSchema,
} from "../types";

export const subscribeAccount = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/:accountId/subscribe",
		tags: ["WhatsApp"],
		summary: "Subscribe WhatsApp account to Meta webhook events",
	})
	.input(subscribeAccountInputSchema)
	.output(subscribeAccountOutputSchema)
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
				message: "Only Cloud API accounts can be subscribed right now",
			});
		}

		const accessToken = decryptWhatsAppSecret(account.accessToken);
		if (!accessToken || !account.wabaId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Account is missing WABA ID or access token",
			});
		}

		await subscribeCloudApiApp({
			accessToken,
			wabaId: account.wabaId,
			apiVersion: account.apiVersion,
		}).catch(async (error) => {
			const message =
				error instanceof Error
					? error.message
					: "Failed to subscribe WhatsApp account";

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

		await db
			.update(waAccounts)
			.set({
				lastErrorMessage: null,
				lastEventAt: account.lastEventAt,
			})
			.where(eq(waAccounts.id, account.id));

		return {
			data: { id: account.id },
			message: "WhatsApp account subscribed to webhook events",
		};
	});
