import { and, db, eq, isNull, lte, or, sql } from "@repo/database";
import {
	waCampaignRecipients,
	waCampaigns,
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
} from "@repo/whatsapp-db";
import { refreshCampaignCounts } from "./delivery-transitions";
import type { WhatsAppTransaction } from "./types";

type AudienceFilter = {
	tag?: string;
	linkType?: "all" | "linked" | "unlinked" | "client" | "crew";
	excludeOptedOut?: boolean;
	excludeBlocked?: boolean;
};

export const getCampaignAudienceConditions = (
	organizationId: string,
	accountId: string,
	filter: AudienceFilter,
) => {
	const conditions = [
		eq(waContacts.organizationId, organizationId),
		eq(waContacts.accountId, accountId),
	];
	if (filter.tag) {
		conditions.push(
			sql`coalesce(${waContacts.tags}, '[]'::jsonb) ? ${filter.tag}`,
		);
	}
	if (filter.excludeOptedOut !== false) {
		conditions.push(eq(waContacts.isOptedOut, false));
	}
	if (filter.excludeBlocked !== false) {
		conditions.push(eq(waContacts.isBlocked, false));
	}
	if (filter.linkType === "linked") {
		conditions.push(sql`${waContacts.externalId} is not null`);
	}
	if (filter.linkType === "unlinked") {
		conditions.push(sql`${waContacts.externalId} is null`);
	}
	if (filter.linkType === "client" || filter.linkType === "crew") {
		conditions.push(eq(waContacts.externalSource, filter.linkType));
	}
	return conditions;
};

const ensureConversation = async (
	tx: WhatsAppTransaction,
	params: { organizationId: string; accountId: string; contactId: string },
) => {
	const [created] = await tx
		.insert(waConversations)
		.values(params)
		.onConflictDoNothing({
			target: [waConversations.accountId, waConversations.contactId],
		})
		.returning({ id: waConversations.id });
	if (created) {
		return created.id;
	}

	const [existing] = await tx
		.select({ id: waConversations.id })
		.from(waConversations)
		.where(
			and(
				eq(waConversations.accountId, params.accountId),
				eq(waConversations.contactId, params.contactId),
			),
		)
		.limit(1);
	if (!existing) {
		throw new Error("Failed to resolve campaign conversation");
	}
	return existing.id;
};

export const materializeCampaignRecipients = async (campaignId: string) => {
	return db.transaction(async (tx) => {
		const [campaign] = await tx
			.select()
			.from(waCampaigns)
			.where(eq(waCampaigns.id, campaignId))
			.for("update");
		if (!campaign) {
			throw new Error("WhatsApp campaign not found");
		}
		if (campaign.audienceCapturedAt) {
			const [count] = await tx
				.select({ value: sql<number>`count(*)::int` })
				.from(waCampaignRecipients)
				.where(eq(waCampaignRecipients.campaignId, campaign.id));
			return count?.value ?? 0;
		}

		const filter = (campaign.audienceFilter ?? {}) as AudienceFilter;
		const contacts = await tx
			.select({ id: waContacts.id })
			.from(waContacts)
			.where(
				and(
					...getCampaignAudienceConditions(
						campaign.organizationId,
						campaign.accountId,
						filter,
					),
				),
			);
		for (let offset = 0; offset < contacts.length; offset += 500) {
			const batch = contacts.slice(offset, offset + 500);
			if (batch.length > 0) {
				await tx
					.insert(waCampaignRecipients)
					.values(
						batch.map((contact) => ({
							organizationId: campaign.organizationId,
							accountId: campaign.accountId,
							campaignId: campaign.id,
							contactId: contact.id,
						})),
					)
					.onConflictDoNothing({
						target: [
							waCampaignRecipients.campaignId,
							waCampaignRecipients.accountId,
							waCampaignRecipients.contactId,
						],
					});
			}
		}
		await tx
			.update(waCampaigns)
			.set({
				audienceCapturedAt: new Date(),
				estimatedRecipients: contacts.length,
				updatedAt: new Date(),
			})
			.where(eq(waCampaigns.id, campaign.id));
		await refreshCampaignCounts(tx, campaign.id);
		return contacts.length;
	});
};

export const enqueueCampaignRecipient = async (recipientId: string) =>
	db.transaction(async (tx) => {
		const [recipient] = await tx
			.select()
			.from(waCampaignRecipients)
			.where(eq(waCampaignRecipients.id, recipientId))
			.for("update");
		if (!recipient || recipient.status !== "pending") {
			return { enqueued: false as const, recipient };
		}

		const [campaign] = await tx
			.select()
			.from(waCampaigns)
			.where(eq(waCampaigns.id, recipient.campaignId))
			.limit(1);
		if (!campaign) {
			throw new Error("Campaign disappeared while enqueueing recipient");
		}

		const conversationId = await ensureConversation(tx, {
			organizationId: recipient.organizationId,
			accountId: recipient.accountId,
			contactId: recipient.contactId,
		});
		const now = new Date();
		const [message] = await tx
			.insert(waMessages)
			.values({
				organizationId: recipient.organizationId,
				accountId: recipient.accountId,
				conversationId,
				contactId: recipient.contactId,
				direction: "outbound",
				type: campaign.messageType,
				textBody: campaign.textBody,
				mediaId: campaign.mediaId,
				templateName: campaign.templateName,
				templateParams: campaign.templateParams,
				status: "queued",
				statusUpdatedAt: now,
				sentByCampaignId: campaign.id,
				campaignRecipientId: recipient.id,
			})
			.returning({ id: waMessages.id, createdAt: waMessages.createdAt });
		if (!message) {
			throw new Error("Failed to create campaign recipient message");
		}

		await tx.insert(waOutbox).values({
			organizationId: recipient.organizationId,
			accountId: recipient.accountId,
			messageId: message.id,
		});
		await tx
			.update(waCampaignRecipients)
			.set({
				messageId: message.id,
				status: "queued",
				queuedAt: now,
				updatedAt: now,
			})
			.where(eq(waCampaignRecipients.id, recipient.id));
		await tx
			.update(waConversations)
			.set({
				lastMessageId: message.id,
				lastMessageAt: message.createdAt,
				lastMessagePreview:
					campaign.textBody ??
					`Template: ${campaign.templateName ?? "message"}`,
				updatedAt: now,
			})
			.where(eq(waConversations.id, conversationId));
		return { enqueued: true as const, recipientId: recipient.id };
	});

export const enqueueWhatsAppCampaign = async (campaignId: string) => {
	await materializeCampaignRecipients(campaignId);
	await db
		.update(waCampaigns)
		.set({
			status: "running",
			startedAt: new Date(),
			updatedAt: new Date(),
		})
		.where(eq(waCampaigns.id, campaignId));

	const recipients = await db
		.select({ id: waCampaignRecipients.id })
		.from(waCampaignRecipients)
		.where(
			and(
				eq(waCampaignRecipients.campaignId, campaignId),
				eq(waCampaignRecipients.status, "pending"),
			),
		);
	let enqueued = 0;
	const failedRecipientIds: string[] = [];
	for (const recipient of recipients) {
		try {
			const result = await enqueueCampaignRecipient(recipient.id);
			if (result.enqueued) {
				enqueued += 1;
			}
		} catch (error) {
			failedRecipientIds.push(recipient.id);
			await db
				.update(waCampaignRecipients)
				.set({
					failureCode: "enqueue_failed",
					failureMessage:
						error instanceof Error
							? error.message
							: "Unknown enqueue failure",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(waCampaignRecipients.id, recipient.id),
						eq(waCampaignRecipients.status, "pending"),
					),
				);
		}
	}

	await db.transaction((tx) => refreshCampaignCounts(tx, campaignId));
	return { enqueued, failedRecipientIds, recipients: recipients.length };
};

export const processDueWhatsAppCampaigns = async ({
	limit = 10,
	now = new Date(),
}: {
	limit?: number;
	now?: Date;
} = {}) => {
	const due = await db
		.select({ id: waCampaigns.id })
		.from(waCampaigns)
		.where(
			or(
				and(
					eq(waCampaigns.status, "scheduled"),
					lte(waCampaigns.scheduledAt, now),
				),
				and(
					eq(waCampaigns.status, "running"),
					isNull(waCampaigns.completedAt),
				),
			),
		)
		.limit(limit);

	for (const campaign of due) {
		await enqueueWhatsAppCampaign(campaign.id);
	}
	return due.length;
};
