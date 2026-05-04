type TemplateComponent = {
	type?: string;
	format?: string;
	text?: string;
	buttons?: Array<{
		type?: string;
		text?: string;
		url?: string;
	}>;
};

export type WhatsAppTemplateVariable = {
	key: string;
	componentType: "header" | "body" | "button";
	index: number;
	label: string;
	buttonIndex: number | null;
	buttonSubType: string | null;
};

export type WhatsAppTemplateInspection = {
	headerText: string | null;
	bodyText: string | null;
	footerText: string | null;
	buttonLabels: string[];
	variables: WhatsAppTemplateVariable[];
	isSupported: boolean;
	unsupportedReason: string | null;
};

const PLACEHOLDER_REGEX = /{{\s*(\d+)\s*}}/g;

const extractPlaceholderIndexes = (value: string) => {
	const matches = value.matchAll(PLACEHOLDER_REGEX);
	const indexes = new Set<number>();

	for (const match of matches) {
		const parsed = Number(match[1]);
		if (Number.isInteger(parsed) && parsed > 0) {
			indexes.add(parsed);
		}
	}

	return [...indexes].sort((left, right) => left - right);
};

const createTextVariables = (componentType: "header" | "body", text: string) =>
	extractPlaceholderIndexes(text).map((index) => ({
		key: `${componentType}:${index}`,
		componentType,
		index,
		label: `${componentType === "header" ? "Header" : "Body"} variable ${index}`,
		buttonIndex: null,
		buttonSubType: null,
	})) satisfies WhatsAppTemplateVariable[];

export const inspectWhatsAppTemplate = (
	components: unknown,
): WhatsAppTemplateInspection => {
	const normalizedComponents = Array.isArray(components)
		? (components as TemplateComponent[])
		: [];

	let headerText: string | null = null;
	let bodyText: string | null = null;
	let footerText: string | null = null;
	let unsupportedReason: string | null = null;
	const buttonLabels: string[] = [];
	const variables: WhatsAppTemplateVariable[] = [];

	for (const component of normalizedComponents) {
		const type = component.type?.toUpperCase();

		if (type === "HEADER") {
			headerText = component.text ?? null;

			if (component.format && component.format !== "TEXT") {
				unsupportedReason =
					unsupportedReason ??
					`Header format ${component.format.toLowerCase()} is not supported in the inbox template sender yet.`;
				continue;
			}

			if (component.text) {
				variables.push(
					...createTextVariables("header", component.text),
				);
			}
			continue;
		}

		if (type === "BODY") {
			bodyText = component.text ?? null;
			if (component.text) {
				variables.push(...createTextVariables("body", component.text));
			}
			continue;
		}

		if (type === "FOOTER") {
			footerText = component.text ?? null;
			continue;
		}

		if (type !== "BUTTONS") {
			continue;
		}

		for (const [buttonIndex, button] of (
			component.buttons ?? []
		).entries()) {
			buttonLabels.push(button.text ?? `Button ${buttonIndex + 1}`);

			if (!button.url) {
				continue;
			}

			const indexes = extractPlaceholderIndexes(button.url);
			if (indexes.length === 0) {
				continue;
			}

			if ((button.type ?? "").toUpperCase() !== "URL") {
				unsupportedReason =
					unsupportedReason ??
					"Only URL button template variables are supported right now.";
				continue;
			}

			for (const index of indexes) {
				variables.push({
					key: `button:${buttonIndex}:${index}`,
					componentType: "button",
					index,
					label: `${button.text ?? `Button ${buttonIndex + 1}`} variable ${index}`,
					buttonIndex,
					buttonSubType: "url",
				});
			}
		}
	}

	return {
		headerText,
		bodyText,
		footerText,
		buttonLabels,
		variables,
		isSupported: unsupportedReason === null,
		unsupportedReason,
	};
};
