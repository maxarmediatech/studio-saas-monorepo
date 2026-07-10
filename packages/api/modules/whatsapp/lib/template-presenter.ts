import type { waTemplates } from "@repo/whatsapp-db";
import { inspectWhatsAppTemplate } from "./template-inspector";

type WhatsAppTemplateRecord = typeof waTemplates.$inferSelect;

export const toWhatsAppTemplateSummary = (template: WhatsAppTemplateRecord) => {
	const inspection = inspectWhatsAppTemplate(template.components);

	return {
		id: template.id,
		accountId: template.accountId,
		providerTemplateId: template.providerTemplateId ?? null,
		name: template.name,
		language: template.language,
		status: template.status,
		category: template.category,
		headerText: inspection.headerText,
		bodyText: inspection.bodyText,
		footerText: inspection.footerText,
		buttonLabels: inspection.buttonLabels,
		variables: inspection.variables,
		isSupported: inspection.isSupported,
		unsupportedReason: inspection.unsupportedReason,
		lastSyncedAt: template.lastSyncedAt,
		createdAt: template.createdAt,
		updatedAt: template.updatedAt,
	};
};
