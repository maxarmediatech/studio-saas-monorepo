import { ORPCError } from "@orpc/server";
import { and, db, eq, sql } from "@repo/database";
import { waCampaigns, waContacts, waTemplates } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { findActiveWhatsAppAccount } from "../lib/account-repository";
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

function getAudienceConditions(
	organizationId: string,
	accountId: string,
	audienceFilter: {
		tag?: string;
		linkType: "all" | "linked" | "unlinked" | "client" | "crew";
		excludeOptedOut: boolean;
		excludeBlocked: boolean;
	},
) {
	const conditions = [
		eq(waContacts.organizationId, organizationId),
		eq(waContacts.accountId, accountId),
	];

	if (audienceFilter.tag) {
		conditions.push(
			sql`coalesce(${waContacts.tags}, '[]'::jsonb) ? ${audienceFilter.tag}`,
		);
	}

	if (audienceFilter.excludeOptedOut) {
		conditions.push(eq(waContacts.isOptedOut, false));
	}

	if (audienceFilter.excludeBlocked) {
		conditions.push(eq(waContacts.isBlocked, false));
	}

	if (audienceFilter.linkType === "linked") {
		conditions.push(sql`${waContacts.externalId} IS NOT NULL`);
	}

	if (audienceFilter.linkType === "unlinked") {
		conditions.push(sql`${waContacts.externalId} IS NULL`);
	}

	if (audienceFilter.linkType === "client") {
		conditions.push(eq(waContacts.externalSource, "client"));
	}

	if (audienceFilter.linkType === "crew") {
		conditions.push(eq(waContacts.externalSource, "crew"));
	}

	return conditions;
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

		const audienceConditions = getAudienceConditions(
			context.organizationId,
			input.accountId,
			input.audienceFilter,
		);
		const [recipientCount] = await db
			.select({ count: sql<number>`count(*)::int` })
			.from(waContacts)
			.where(and(...audienceConditions));

		const now = new Date();
		const status =
			input.action === "schedule"
				? "scheduled"
				: input.action === "send"
					? "running"
					: "draft";
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
				templateParams: {
					language: input.language,
					variableValues: input.variableValues,
				},
				audienceFilter: input.audienceFilter,
				estimatedRecipients: recipientCount?.count ?? 0,
				scheduledAt:
					input.action === "schedule" ? input.scheduledAt : null,
				startedAt: input.action === "send" ? now : null,
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
