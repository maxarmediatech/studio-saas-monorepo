import type { whatsappTemplateSummarySchema } from "@repo/api/modules/whatsapp/types";
import type { z } from "zod";

type WhatsAppTemplate = z.infer<typeof whatsappTemplateSummarySchema>;

export function buildTemplateSendComponents(
	template: WhatsAppTemplate,
	variableValues: Record<string, string>,
) {
	const groupedComponents = new Map<
		string,
		{
			type: string;
			subType?: string;
			index?: number;
			parameters: Array<{ type: "text"; text: string }>;
		}
	>();

	for (const variable of template.variables) {
		const value = variableValues[variable.key]?.trim();
		if (!value) {
			throw new Error(`${variable.label} is required`);
		}

		const groupKey =
			variable.componentType === "button"
				? `button:${variable.buttonIndex ?? 0}`
				: variable.componentType;

		const existingGroup = groupedComponents.get(groupKey) ?? {
			type: variable.componentType,
			parameters: [],
		};

		if (variable.componentType === "button") {
			existingGroup.subType = variable.buttonSubType ?? undefined;
			existingGroup.index = variable.buttonIndex ?? 0;
		}

		existingGroup.parameters[variable.index - 1] = {
			type: "text",
			text: value,
		};

		groupedComponents.set(groupKey, existingGroup);
	}

	return [...groupedComponents.values()].map((component) => ({
		type: component.type,
		subType: component.subType,
		index: component.index,
		parameters: component.parameters.filter(Boolean),
	}));
}
