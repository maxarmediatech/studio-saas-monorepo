import { and, db, eq, lte, sql } from "@repo/database";
import { logger } from "@repo/logs";
import {
	waCampaigns,
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
	waTemplates,
} from "@repo/whatsapp-db";
import { recordOutboundConversationActivity } from "./outbound-activity";
import {
	inspectWhatsAppTemplate,
	type WhatsAppTemplateVariable,
} from "./template-inspector";
import { renderWhatsAppTemplateMessage } from "./template-renderer";
import { triggerWhatsAppOutbox } from "./trigger-outbox";

type AudienceFilter = {
	tag?: string;
	linkType: "all" | "linked" | "unlinked" | "client" | "crew";
	excludeOptedOut: boolean;
	excludeBlocked: boolean;
};

type TemplateParams = {
	language: string;
	components: Array<{
		type: string;
		parameters?: Array<Record<string, unknown>>;
		subType?: string;
		index?: number;
	}>;
};

export function getCampaignAudienceConditions(
	organizationId: string,
	accountId: string,
	audienceFilter: AudienceFilter,
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

function getVariableValue(
	variable: WhatsAppTemplateVariable,
	variableValues: Record<string, string>,
) {
	const value = variableValues[variable.key]?.trim();
	if (!value) {
		throw new Error(`Missing value for ${variable.label}`);
	}
	return value;
}

function buildTextComponent(
	type: "header" | "body",
	variables: WhatsAppTemplateVariable[],
	variableValues: Record<string, string>,
) {
	const parameters = variables
		.filter((variable) => variable.componentType === type)
		.sort((left, right) => left.index - right.index)
		.map((variable) => ({
			type: "text",
			text: getVariableValue(variable, variableValues),
		}));

	return parameters.length > 0 ? { type, parameters } : null;
}

function buildButtonComponents(
	variables: WhatsAppTemplateVariable[],
	variableValues: Record<string, string>,
) {
	return variables
		.filter((variable) => variable.componentType === "button")
		.map((variable) => ({
			type: "button",
			subType: variable.buttonSubType ?? "url",
			index: variable.buttonIndex ?? 0,
			parameters: [
				{
					type: "text",
					text: getVariableValue(variable, variableValues),
				},
			],
		}));
}

export function buildTemplateParams(params: {
	language: string;
	variables: WhatsAppTemplateVariable[];
	variableValues: Record<string, string>;
}): TemplateParams {
	const components: TemplateParams["components"] = [];
	const header = buildTextComponent(
		"header",
		params.variables,
		params.variableValues,
	);
	const body = buildTextComponent(
		"body",
		params.variables,
		params.variableValues,
	);

	if (header) {
		components.push(header);
	}

	if (body) {
		components.push(body);
	}

	components.push(
		...buildButtonComponents(params.variables, params.variableValues),
	);

	return {
		language: params.language,
		components,
	};
}

async function ensureCampaignConversation(params: {
	organizationId: string;
	accountId: string;
	contactId: string;
}) {
	const existing = await db.query.waConversations.findFirst({
		where: and(
			eq(waConversations.organizationId, params.organizationId),
			eq(waConversations.accountId, params.accountId),
			eq(waConversations.contactId, params.contactId),
		),
	});

	if (existing) {
		return existing.id;
	}

	const [created] = await db
		.insert(waConversations)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			contactId: params.contactId,
		})
		.returning({ id: waConversations.id });

	if (!created) {
		throw new Error("Failed to create campaign conversation");
	}

	return created.id;
}

async function enqueueCampaignMessage(params: {
	organizationId: string;
	accountId: string;
	campaignId: string;
	contactId: string;
	conversationId: string;
	templateName: string;
	templateParams: TemplateParams;
	preview: string;
}) {
	const [createdMessage] = await db
		.insert(waMessages)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			conversationId: params.conversationId,
			contactId: params.contactId,
			direction: "outbound",
			type: "template",
			templateName: params.templateName,
			templateParams: params.templateParams,
			status: "pending",
			sentByCampaignId: params.campaignId,
		})
		.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

	if (!createdMessage) {
		throw new Error("Failed to create campaign message");
	}

	await recordOutboundConversationActivity({
		organizationId: params.organizationId,
		conversationId: params.conversationId,
		contactId: params.contactId,
		messageId: createdMessage.id,
		preview: params.preview,
		at: createdMessage.createdAt,
	});

	const [outbox] = await db
		.insert(waOutbox)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			messageId: createdMessage.id,
		})
		.returning({ id: waOutbox.id });

	if (!outbox) {
		throw new Error("Failed to enqueue campaign message");
	}

	await triggerWhatsAppOutbox({
		outboxId: outbox.id,
		messageId: createdMessage.id,
	});
}

export async function runCampaignNow(campaignId: string) {
	const campaign = await db.query.waCampaigns.findFirst({
		where: eq(waCampaigns.id, campaignId),
	});

	if (!campaign) {
		throw new Error("Campaign not found");
	}

	if (!campaign.templateName) {
		throw new Error("Campaign template is missing");
	}

	const rawParams =
		typeof campaign.templateParams === "object" &&
		campaign.templateParams !== null
			? (campaign.templateParams as {
					language?: unknown;
					variableValues?: unknown;
				})
			: {};
	const language =
		typeof rawParams.language === "string" ? rawParams.language : null;
	const variableValues =
		typeof rawParams.variableValues === "object" &&
		rawParams.variableValues !== null
			? (rawParams.variableValues as Record<string, string>)
			: {};

	if (!language) {
		throw new Error("Campaign template language is missing");
	}

	const template = await db.query.waTemplates.findFirst({
		where: and(
			eq(waTemplates.organizationId, campaign.organizationId),
			eq(waTemplates.accountId, campaign.accountId),
			eq(waTemplates.name, campaign.templateName),
			eq(waTemplates.language, language),
		),
	});

	if (!template) {
		throw new Error("Campaign template is not synced");
	}

	const inspection = inspectWhatsAppTemplate(template.components);
	if (!inspection.isSupported) {
		throw new Error(
			inspection.unsupportedReason ??
				"Campaign template is not supported yet",
		);
	}

	const templateParams = buildTemplateParams({
		language,
		variables: inspection.variables,
		variableValues,
	});
	const preview =
		renderWhatsAppTemplateMessage({
			components: template.components,
			params: templateParams,
		}) ?? `Template: ${campaign.templateName}`;

	const audienceFilter = campaign.audienceFilter as AudienceFilter | null;
	if (!audienceFilter) {
		throw new Error("Campaign audience filter is missing");
	}

	const contacts = await db
		.select({
			id: waContacts.id,
		})
		.from(waContacts)
		.where(
			and(
				...getCampaignAudienceConditions(
					campaign.organizationId,
					campaign.accountId,
					audienceFilter,
				),
			),
		);

	let totalSent = 0;
	let totalFailed = 0;

	for (const contact of contacts) {
		try {
			const conversationId = await ensureCampaignConversation({
				organizationId: campaign.organizationId,
				accountId: campaign.accountId,
				contactId: contact.id,
			});

			await enqueueCampaignMessage({
				organizationId: campaign.organizationId,
				accountId: campaign.accountId,
				campaignId: campaign.id,
				contactId: contact.id,
				conversationId,
				templateName: campaign.templateName,
				templateParams,
				preview,
			});
			totalSent += 1;
		} catch (error) {
			totalFailed += 1;
			logger.error("Failed to enqueue WhatsApp campaign recipient", {
				campaignId: campaign.id,
				contactId: contact.id,
				error,
			});
		}
	}

	await db
		.update(waCampaigns)
		.set({
			status: "completed",
			startedAt: campaign.startedAt ?? new Date(),
			completedAt: new Date(),
			totalSent,
			totalFailed,
			updatedAt: new Date(),
		})
		.where(eq(waCampaigns.id, campaign.id));
}

export async function processDueScheduledCampaigns({
	limit = 10,
	now = new Date(),
}: {
	limit?: number;
	now?: Date;
} = {}) {
	const dueCampaigns = await db
		.select({ id: waCampaigns.id })
		.from(waCampaigns)
		.where(
			and(
				eq(waCampaigns.status, "scheduled"),
				lte(waCampaigns.scheduledAt, now),
			),
		)
		.limit(limit);

	let processed = 0;
	let failed = 0;

	for (const campaign of dueCampaigns) {
		const [claimed] = await db
			.update(waCampaigns)
			.set({
				status: "running",
				startedAt: now,
				updatedAt: now,
			})
			.where(
				and(
					eq(waCampaigns.id, campaign.id),
					eq(waCampaigns.status, "scheduled"),
				),
			)
			.returning({ id: waCampaigns.id });

		if (!claimed) {
			continue;
		}

		try {
			await runCampaignNow(claimed.id);
			processed += 1;
		} catch (error) {
			failed += 1;
			logger.error("Failed to process scheduled WhatsApp campaign", {
				campaignId: claimed.id,
				error,
			});

			await db
				.update(waCampaigns)
				.set({
					status: "paused",
					updatedAt: new Date(),
				})
				.where(eq(waCampaigns.id, claimed.id));
		}
	}

	return {
		processed,
		failed,
		checked: dueCampaigns.length,
	};
}
