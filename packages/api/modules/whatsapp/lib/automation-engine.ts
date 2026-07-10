import { and, count, db, eq, ne, sql } from "@repo/database";
import { logger } from "@repo/logs";
import {
	waBotFlows,
	waContacts,
	waConversations,
	waMessages,
	waOutbox,
	waTemplates,
} from "@repo/whatsapp-db";
import type { z } from "zod";
import { automationFlowDataSchema } from "../types";
import { recordOutboundConversationActivity } from "./outbound-activity";
import { inspectWhatsAppTemplate } from "./template-inspector";
import { renderWhatsAppTemplateMessage } from "./template-renderer";
import { triggerWhatsAppOutbox } from "./trigger-outbox";

type AutomationAction = z.infer<
	typeof automationFlowDataSchema
>["actions"][number];
type BotFlow = typeof waBotFlows.$inferSelect;

const normalizeKeywords = (value: unknown) =>
	Array.isArray(value)
		? value
				.filter(
					(keyword): keyword is string => typeof keyword === "string",
				)
				.map((keyword) => keyword.trim().toLowerCase())
				.filter(Boolean)
		: [];

const getFlowActions = (flow: BotFlow) => {
	const parsed = automationFlowDataSchema.safeParse(flow.flowData);

	if (!parsed.success) {
		logger.warn("Skipping invalid WhatsApp automation flow data", {
			flowId: flow.id,
			error: parsed.error.flatten(),
		});
		return [];
	}

	return parsed.data.actions;
};

const hasKeywordMatch = (flow: BotFlow, inboundText: string) => {
	const normalizedText = inboundText.trim().toLowerCase();
	if (!normalizedText) {
		return false;
	}

	return normalizeKeywords(flow.triggerKeywords).some((keyword) =>
		normalizedText.includes(keyword),
	);
};

const isFirstInboundMessage = async (params: {
	organizationId: string;
	conversationId: string;
	inboundMessageId: string;
}) => {
	const [row] = await db
		.select({ value: count() })
		.from(waMessages)
		.where(
			and(
				eq(waMessages.organizationId, params.organizationId),
				eq(waMessages.conversationId, params.conversationId),
				eq(waMessages.direction, "inbound"),
				ne(waMessages.id, params.inboundMessageId),
			),
		);

	return (row?.value ?? 0) === 0;
};

const enqueueTextMessage = async (params: {
	organizationId: string;
	accountId: string;
	contactId: string;
	conversationId: string;
	flowId: string;
	text: string;
}) => {
	const [createdMessage] = await db
		.insert(waMessages)
		.values({
			organizationId: params.organizationId,
			accountId: params.accountId,
			conversationId: params.conversationId,
			contactId: params.contactId,
			direction: "outbound",
			type: "text",
			textBody: params.text,
			status: "pending",
			sentByBotFlowId: params.flowId,
		})
		.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

	if (!createdMessage) {
		throw new Error("Failed to create automation text message");
	}

	await recordOutboundConversationActivity({
		organizationId: params.organizationId,
		conversationId: params.conversationId,
		contactId: params.contactId,
		messageId: createdMessage.id,
		preview: params.text,
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
		throw new Error("Failed to enqueue automation text message");
	}

	await triggerWhatsAppOutbox({
		outboxId: outbox.id,
		messageId: createdMessage.id,
	});
};

const enqueueTemplateMessage = async (params: {
	organizationId: string;
	accountId: string;
	contactId: string;
	conversationId: string;
	flowId: string;
	templateName: string;
	language: string;
}) => {
	const template = await db.query.waTemplates.findFirst({
		where: and(
			eq(waTemplates.organizationId, params.organizationId),
			eq(waTemplates.accountId, params.accountId),
			eq(waTemplates.name, params.templateName),
			eq(waTemplates.language, params.language),
		),
	});

	if (!template) {
		throw new Error("Automation template is not synced");
	}

	if (template.status.toLowerCase() !== "approved") {
		throw new Error("Automation template is not approved");
	}

	const inspection = inspectWhatsAppTemplate(template.components);
	if (!inspection.isSupported) {
		throw new Error(
			inspection.unsupportedReason ??
				"Automation template is not supported yet",
		);
	}

	if (inspection.variables.length > 0) {
		throw new Error("Automation template variables are not mapped yet");
	}

	const templateParams = {
		language: params.language,
		components: [],
	};

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
			templateParams,
			status: "pending",
			sentByBotFlowId: params.flowId,
		})
		.returning({ id: waMessages.id, createdAt: waMessages.createdAt });

	if (!createdMessage) {
		throw new Error("Failed to create automation template message");
	}

	await recordOutboundConversationActivity({
		organizationId: params.organizationId,
		conversationId: params.conversationId,
		contactId: params.contactId,
		messageId: createdMessage.id,
		preview:
			renderWhatsAppTemplateMessage({
				components: template.components,
				params: templateParams,
			}) ?? `Template: ${params.templateName}`,
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
		throw new Error("Failed to enqueue automation template message");
	}

	await triggerWhatsAppOutbox({
		outboxId: outbox.id,
		messageId: createdMessage.id,
	});
};

const addContactTag = async (params: {
	organizationId: string;
	contactId: string;
	tag: string;
}) => {
	await db
		.update(waContacts)
		.set({
			tags: sql`case
				when coalesce(${waContacts.tags}, '[]'::jsonb) ? ${params.tag}
					then coalesce(${waContacts.tags}, '[]'::jsonb)
				else coalesce(${waContacts.tags}, '[]'::jsonb) || jsonb_build_array(${params.tag})
			end`,
			updatedAt: new Date(),
		})
		.where(
			and(
				eq(waContacts.organizationId, params.organizationId),
				eq(waContacts.id, params.contactId),
			),
		);
};

const executeAction = async (
	action: AutomationAction,
	params: {
		organizationId: string;
		accountId: string;
		contactId: string;
		conversationId: string;
		flowId: string;
	},
) => {
	if (action.type === "send_text") {
		await enqueueTextMessage({ ...params, text: action.text });
		return true;
	}

	if (action.type === "send_template") {
		await enqueueTemplateMessage({
			...params,
			templateName: action.templateName,
			language: action.language,
		});
		return true;
	}

	if (action.type === "add_tag") {
		await addContactTag({
			organizationId: params.organizationId,
			contactId: params.contactId,
			tag: action.tag,
		});
		return true;
	}

	if (action.type === "assign_conversation") {
		await db
			.update(waConversations)
			.set({
				assignedToUserId: action.userId,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(waConversations.organizationId, params.organizationId),
					eq(waConversations.id, params.conversationId),
				),
			);
		return true;
	}

	if (action.type === "close_conversation") {
		await db
			.update(waConversations)
			.set({
				status: "closed",
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(waConversations.organizationId, params.organizationId),
					eq(waConversations.id, params.conversationId),
				),
			);
		return true;
	}

	logger.info("WhatsApp automation wait action reached", {
		flowId: params.flowId,
		durationMinutes: action.durationMinutes,
	});
	return false;
};

export async function runInboundAutomations(params: {
	organizationId: string;
	accountId: string;
	contactId: string;
	conversationId: string;
	inboundMessageId: string;
	inboundText: string;
}) {
	const [flows, isFirstInbound] = await Promise.all([
		db.query.waBotFlows.findMany({
			where: and(
				eq(waBotFlows.organizationId, params.organizationId),
				eq(waBotFlows.accountId, params.accountId),
				eq(waBotFlows.status, "published"),
			),
		}),
		isFirstInboundMessage({
			organizationId: params.organizationId,
			conversationId: params.conversationId,
			inboundMessageId: params.inboundMessageId,
		}),
	]);

	for (const flow of flows) {
		const triggerMatches =
			flow.triggerType === "first_inbound"
				? isFirstInbound
				: hasKeywordMatch(flow, params.inboundText);

		if (!triggerMatches) {
			continue;
		}

		try {
			for (const action of getFlowActions(flow)) {
				const shouldContinue = await executeAction(action, {
					organizationId: params.organizationId,
					accountId: params.accountId,
					contactId: params.contactId,
					conversationId: params.conversationId,
					flowId: flow.id,
				});

				if (!shouldContinue) {
					break;
				}
			}

			await db
				.update(waBotFlows)
				.set({
					totalTriggered: sql`coalesce(${waBotFlows.totalTriggered}, 0) + 1`,
					lastTriggeredAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(waBotFlows.id, flow.id));
		} catch (error) {
			logger.error("Failed to execute WhatsApp automation flow", {
				flowId: flow.id,
				error,
			});
		}
	}
}
