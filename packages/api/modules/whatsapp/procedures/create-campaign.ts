import { ORPCError } from "@orpc/server";
import { and, db, eq, sql } from "@repo/database";
import { waCampaigns, waContacts, waTemplates } from "@repo/whatsapp-db";
import { getCampaignAudienceConditions } from "@repo/whatsapp-runtime";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
import { buildCampaignTemplateParams } from "../lib/campaign-template-params";
import { inspectWhatsAppTemplate } from "../lib/template-inspector";
import {
	createCampaignInputSchema,
	createCampaignOutputSchema,
} from "../types";

function toCampaignItem(campaign: typeof waCampaigns.$inferSelect) {
	return {
		id: campaign.id,
		accountId: campaign.accountId,
		name: campaign.name,
		description: campaign.description ?? null,
		status: campaign.status,
		messageType: campaign.messageType,
		templateName: campaign.templateName ?? null,
		audienceFilter: campaign.audienceFilter ?? null,
		estimatedRecipients: campaign.estimatedRecipients ?? 0,
		scheduledAt: campaign.scheduledAt ?? null,
		startedAt: campaign.startedAt ?? null,
		completedAt: campaign.completedAt ?? null,
		totalSent: campaign.totalSent ?? 0,
		totalDelivered: campaign.totalDelivered ?? 0,
		totalRead: campaign.totalRead ?? 0,
		totalFailed: campaign.totalFailed ?? 0,
		createdByUserId: campaign.createdByUserId ?? null,
		createdAt: campaign.createdAt,
		updatedAt: campaign.updatedAt,
	};
}

export const createCampaign = studioProtectedProcedure
	.route({
		method: "POST",
		path: "/whatsapp/campaigns",
		tags: ["WhatsApp"],
		summary: "Create WhatsApp broadcast campaign",
	})
	.input(createCampaignInputSchema)
	.output(createCampaignOutputSchema)
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

		const template = await db.query.waTemplates.findFirst({
			where: and(
				eq(waTemplates.organizationId, context.organizationId),
				eq(waTemplates.accountId, input.accountId),
				eq(waTemplates.name, input.templateName),
				eq(waTemplates.language, input.language),
			),
		});

		if (!template) {
			throw new ORPCError("NOT_FOUND", {
				message: "Template not found for this WhatsApp account",
			});
		}

		if (template.status.toLowerCase() !== "approved") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Only approved templates can be used for broadcasts",
			});
		}

		const inspection = inspectWhatsAppTemplate(template.components);
		if (!inspection.isSupported) {
			throw new ORPCError("BAD_REQUEST", {
				message:
					inspection.unsupportedReason ??
					"Template is not supported for broadcasts yet",
			});
		}

		if (input.action !== "draft") {
			const missingVariable = inspection.variables.find((variable) => {
				const value = input.variableValues[variable.key]?.trim();
				return !value;
			});

			if (missingVariable) {
				throw new ORPCError("BAD_REQUEST", {
					message: `Missing value for ${missingVariable.label}`,
				});
			}
		}

		const audienceConditions = getCampaignAudienceConditions(
			context.organizationId,
			input.accountId,
			input.audienceFilter,
		);
		const [recipientCount] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(waContacts)
			.where(and(...audienceConditions));

		const now = new Date();
		const status = input.action === "draft" ? "draft" : "scheduled";
		const templateParams =
			input.action === "draft"
				? {
						language: input.language,
						variableValues: input.variableValues,
					}
				: buildCampaignTemplateParams({
						language: input.language,
						variables: inspection.variables,
						variableValues: input.variableValues,
					});
		const [campaign] = await db
			.insert(waCampaigns)
			.values({
				organizationId: context.organizationId,
				accountId: input.accountId,
				name: input.name,
				description: input.description,
				status,
				messageType: "template",
				templateName: input.templateName,
				templateParams,
				audienceFilter: input.audienceFilter,
				estimatedRecipients: recipientCount?.count ?? 0,
				scheduledAt:
					input.action === "schedule"
						? input.scheduledAt
						: input.action === "send"
							? now
							: null,
				createdByUserId: context.user.id,
				updatedAt: now,
			})
			.returning();

		if (!campaign) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to create broadcast",
			});
		}

		return {
			data: toCampaignItem(campaign),
			message:
				input.action === "draft"
					? "Broadcast draft saved"
					: input.action === "schedule"
						? "Broadcast scheduled"
						: "Broadcast queued",
		};
	});
