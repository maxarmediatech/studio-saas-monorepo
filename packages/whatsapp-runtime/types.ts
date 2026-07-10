import type { db } from "@repo/database";

export type WhatsAppTransaction = Parameters<
	Parameters<typeof db.transaction>[0]
>[0];

export type AutomationAction =
	| { type: "send_text"; text: string }
	| { type: "send_template"; templateName: string; language: string }
	| { type: "add_tag"; tag: string }
	| { type: "assign_conversation"; userId: string }
	| { type: "wait"; durationMinutes: number }
	| { type: "close_conversation" };

export type AutomationFlowData = { actions: AutomationAction[] };
