import type { waBotFlows } from "@repo/whatsapp-db";
import type { z } from "zod";
import { automationFlowDataSchema, type automationItemSchema } from "../types";

type AutomationRecord = typeof waBotFlows.$inferSelect;
type AutomationFlowData = z.infer<typeof automationFlowDataSchema>;
type AutomationItem = z.infer<typeof automationItemSchema>;

const defaultFlowData: AutomationFlowData = {
	actions: [{ type: "close_conversation" }],
};

function parseFlowData(value: unknown): AutomationFlowData {
	const parsed = automationFlowDataSchema.safeParse(value);
	return parsed.success ? parsed.data : defaultFlowData;
}

function parseKeywords(value: unknown) {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function parseTriggerType(value: string): "keyword" | "first_inbound" {
	return value === "first_inbound" ? "first_inbound" : "keyword";
}

export function toAutomationItem(flow: AutomationRecord): AutomationItem {
	return {
		id: flow.id,
		accountId: flow.accountId,
		name: flow.name,
		description: flow.description ?? null,
		status: flow.status,
		triggerType: parseTriggerType(flow.triggerType),
		triggerKeywords: parseKeywords(flow.triggerKeywords),
		flowData: parseFlowData(flow.flowData),
		totalTriggered: flow.totalTriggered ?? 0,
		lastTriggeredAt: flow.lastTriggeredAt ?? null,
		publishedAt: flow.publishedAt ?? null,
		createdAt: flow.createdAt,
		updatedAt: flow.updatedAt,
	};
}
