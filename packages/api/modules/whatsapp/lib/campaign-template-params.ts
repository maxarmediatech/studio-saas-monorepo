import type { WhatsAppTemplateVariable } from "./template-inspector";

type TemplateParams = {
	language: string;
	components: Array<{
		type: string;
		parameters?: Array<Record<string, unknown>>;
		subType?: string;
		index?: number;
	}>;
};

const getVariableValue = (
	variable: WhatsAppTemplateVariable,
	variableValues: Record<string, string>,
) => {
	const value = variableValues[variable.key]?.trim();
	if (!value) {
		throw new Error(`Missing value for ${variable.label}`);
	}
	return value;
};

const buildTextComponent = (
	type: "header" | "body",
	variables: WhatsAppTemplateVariable[],
	variableValues: Record<string, string>,
) => {
	const parameters = variables
		.filter((variable) => variable.componentType === type)
		.sort((left, right) => left.index - right.index)
		.map((variable) => ({
			type: "text",
			text: getVariableValue(variable, variableValues),
		}));

	return parameters.length > 0 ? { type, parameters } : null;
};

const buildButtonComponents = (
	variables: WhatsAppTemplateVariable[],
	variableValues: Record<string, string>,
) =>
	variables
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

export const buildCampaignTemplateParams = (params: {
	language: string;
	variables: WhatsAppTemplateVariable[];
	variableValues: Record<string, string>;
}): TemplateParams => {
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

	return { language: params.language, components };
};
