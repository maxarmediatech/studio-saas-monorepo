import type { SmsTemplate } from "../types";

// Template registry - will be populated in Task 5
export const smsTemplates: Record<string, SmsTemplate> = {};

export type TemplateId = keyof typeof smsTemplates;

export function getTemplate(templateId: TemplateId): SmsTemplate {
	const template = smsTemplates[templateId];
	if (!template) {
		throw new Error(`SMS template not found: ${String(templateId)}`);
	}
	return template;
}
