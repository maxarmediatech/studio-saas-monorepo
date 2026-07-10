import { and, db, desc, eq, sql } from "@repo/database";
import { waCampaigns } from "@repo/whatsapp-db";
import { studioProtectedProcedure } from "../../../orpc/procedures";
import { listCampaignsInputSchema, listCampaignsOutputSchema } from "../types";

export const listCampaigns = studioProtectedProcedure
	.route({
		method: "GET",
		path: "/whatsapp/campaigns",
		tags: ["WhatsApp"],
		summary: "List WhatsApp broadcast campaigns",
	})
	.input(listCampaignsInputSchema)
	.output(listCampaignsOutputSchema)
	.handler(async ({ input, context }) => {
		const conditions = [
			eq(waCampaigns.organizationId, context.organizationId),
		];

		if (input.status) {
			conditions.push(eq(waCampaigns.status, input.status));
		}

		if (input.search) {
			const search = `%${input.search}%`;
			conditions.push(
				sql`(${waCampaigns.name} ILIKE ${search} OR coalesce(${waCampaigns.description}, '') ILIKE ${search} OR coalesce(${waCampaigns.templateName}, '') ILIKE ${search})`,
			);
		}

		const campaigns = await db
			.select()
			.from(waCampaigns)
			.where(and(...conditions))
			.orderBy(desc(waCampaigns.createdAt), desc(waCampaigns.id));

		return {
			data: campaigns.map((campaign) => ({
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
			})),
		};
	});
