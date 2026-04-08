import { ORPCError } from "@orpc/server";
import { db, eq } from "@repo/database";
import { waAccounts, waTemplates } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { decryptWhatsAppSecret } from "../lib/account-secrets";
import { listCloudApiTemplates } from "../lib/cloud-api-admin";
import { syncTemplatesInputSchema, syncTemplatesOutputSchema } from "../types";

export const syncTemplates = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/accounts/:accountId/templates/sync",
		tags: ["WhatsApp"],
		summary: "Sync WhatsApp templates from Meta",
	})
	.input(syncTemplatesInputSchema)
	.output(syncTemplatesOutputSchema)
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
				message: "Only Cloud API accounts can sync templates right now",
			});
		}

		const accessToken = decryptWhatsAppSecret(account.accessToken);
		if (!accessToken || !account.wabaId) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Account is missing WABA ID or access token",
			});
		}

		const syncStartedAt = new Date();

		const { apiVersion, templates } = await listCloudApiTemplates({
			accessToken,
			wabaId: account.wabaId,
			apiVersion: account.apiVersion,
		}).catch(async (error) => {
			const message =
				error instanceof Error
					? error.message
					: "Failed to sync WhatsApp templates";

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

		await db.transaction(async (tx) => {
			await tx
				.delete(waTemplates)
				.where(eq(waTemplates.accountId, account.id));

			if (templates.length > 0) {
				await tx.insert(waTemplates).values(
					templates.map((template) => ({
						organizationId: context.organizationId,
						accountId: account.id,
						providerTemplateId: template.providerTemplateId,
						name: template.name,
						language: template.language,
						status: template.status,
						category: template.category,
						components: template.components,
						rejectedReason: template.rejectedReason,
						lastSyncedAt: syncStartedAt,
						updatedAt: syncStartedAt,
					})),
				);
			}

			await tx
				.update(waAccounts)
				.set({
					apiVersion,
					lastValidatedAt: syncStartedAt,
					lastErrorMessage: null,
					updatedAt: syncStartedAt,
				})
				.where(eq(waAccounts.id, account.id));
		});

		return {
			data: {
				accountId: account.id,
				count: templates.length,
				lastSyncedAt: syncStartedAt,
			},
			message:
				templates.length > 0
					? `Synced ${templates.length} WhatsApp templates`
					: "No WhatsApp templates found for this account",
		};
	});
