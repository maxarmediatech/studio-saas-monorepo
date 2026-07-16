import { and, eq, ne, sql } from "@repo/database";
import {
	waAutomationActions,
	waAutomationRuns,
	waBotFlows,
	waMessages,
} from "@repo/whatsapp-db";
import type {
	AutomationAction,
	AutomationFlowData,
	WhatsAppTransaction,
} from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const parseAutomationAction = (
	value: unknown,
): AutomationAction | null => {
	if (!isRecord(value) || typeof value.type !== "string") {
		return null;
	}
	if (value.type === "send_text" && typeof value.text === "string") {
		return { type: value.type, text: value.text };
	}
	if (
		value.type === "send_template" &&
		typeof value.templateName === "string" &&
		typeof value.language === "string"
	) {
		return {
			type: value.type,
			templateName: value.templateName,
			language: value.language,
		};
	}
	if (value.type === "add_tag" && typeof value.tag === "string") {
		return { type: value.type, tag: value.tag };
	}
	if (
		value.type === "assign_conversation" &&
		typeof value.userId === "string"
	) {
		return { type: value.type, userId: value.userId };
	}
	if (
		value.type === "wait" &&
		typeof value.durationMinutes === "number" &&
		Number.isInteger(value.durationMinutes) &&
		value.durationMinutes > 0
	) {
		return { type: value.type, durationMinutes: value.durationMinutes };
	}
	return value.type === "close_conversation" ? { type: value.type } : null;
};

const parseFlowData = (value: unknown): AutomationFlowData | null => {
	if (!isRecord(value) || !Array.isArray(value.actions)) {
		return null;
	}
	const actions = value.actions.map(parseAutomationAction);
	if (
		actions.length === 0 ||
		actions.length > 20 ||
		actions.some((action) => action === null)
	) {
		return null;
	}
	return { actions: actions as AutomationAction[] };
};

const normalizedKeywords = (value: unknown) =>
	Array.isArray(value)
		? value
				.filter((item): item is string => typeof item === "string")
				.map((item) => item.trim().toLowerCase())
				.filter(Boolean)
		: [];

export const enqueueInboundAutomationRuns = async (
	tx: WhatsAppTransaction,
	params: {
		organizationId: string;
		accountId: string;
		contactId: string;
		conversationId: string;
		inboundMessageId: string;
		inboundText: string;
		triggerIdentity?: string;
	},
) => {
	const flows = await tx
		.select()
		.from(waBotFlows)
		.where(
			and(
				eq(waBotFlows.organizationId, params.organizationId),
				eq(waBotFlows.accountId, params.accountId),
				eq(waBotFlows.status, "published"),
			),
		);
	const [inboundCount] = await tx
		.select({ count: sql<number>`count(*)::int` })
		.from(waMessages)
		.where(
			and(
				eq(waMessages.conversationId, params.conversationId),
				eq(waMessages.direction, "inbound"),
				ne(waMessages.id, params.inboundMessageId),
			),
		);
	const isFirstInbound = (inboundCount?.count ?? 0) === 0;
	const inboundText = params.inboundText.trim().toLowerCase();
	let createdRuns = 0;

	for (const flow of flows) {
		const flowData = parseFlowData(flow.flowData);
		if (!flowData) {
			continue;
		}
		const matches =
			flow.triggerType === "first_inbound"
				? isFirstInbound
				: normalizedKeywords(flow.triggerKeywords).some((keyword) =>
						inboundText.includes(keyword),
					);
		if (!matches) {
			continue;
		}

		const now = new Date();
		const triggerIdentity =
			flow.triggerType === "first_inbound"
				? `first-inbound:${params.conversationId}`
				: (params.triggerIdentity ??
					`inbound:${params.inboundMessageId}`);
		const [run] = await tx
			.insert(waAutomationRuns)
			.values({
				organizationId: params.organizationId,
				accountId: params.accountId,
				flowId: flow.id,
				triggerIdentity,
				inboundMessageId: params.inboundMessageId,
				contactId: params.contactId,
				conversationId: params.conversationId,
				flowVersion: flow.publishedVersion ?? flow.schemaVersion,
				actionSnapshot: flowData,
				nextAttemptAt: now,
			})
			.onConflictDoNothing({
				target: [
					waAutomationRuns.flowId,
					waAutomationRuns.triggerIdentity,
				],
			})
			.returning({ id: waAutomationRuns.id });
		if (!run) {
			continue;
		}

		await tx.insert(waAutomationActions).values(
			flowData.actions.map((action, actionIndex) => ({
				organizationId: params.organizationId,
				runId: run.id,
				flowId: flow.id,
				actionIndex,
				type: action.type,
				payload: action,
				nextAttemptAt: now,
			})),
		);
		await tx
			.update(waBotFlows)
			.set({
				totalTriggered: sql`coalesce(${waBotFlows.totalTriggered}, 0) + 1`,
				lastTriggeredAt: now,
				updatedAt: now,
			})
			.where(eq(waBotFlows.id, flow.id));
		createdRuns += 1;
	}
	return createdRuns;
};
