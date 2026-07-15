type TemplateComponent = {
	type?: string;
	text?: string;
};

type TemplateParameter = {
	type?: string;
	text?: string;
	payload?: string;
};

type TemplateSendComponent = {
	type?: string;
	parameters?: TemplateParameter[];
};

const PLACEHOLDER_REGEX = /{{\s*(\d+)\s*}}/g;

function getTemplateParameterValues(params: unknown) {
	if (
		typeof params !== "object" ||
		params === null ||
		!("components" in params) ||
		!Array.isArray(params.components)
	) {
		return new Map<string, string>();
	}

	const values = new Map<string, string>();
	for (const component of params.components as TemplateSendComponent[]) {
		const type = component.type?.toLowerCase();
		if (!type || !Array.isArray(component.parameters)) {
			continue;
		}

		component.parameters.forEach((parameter, index) => {
			values.set(
				`${type}:${index + 1}`,
				parameter.text ?? parameter.payload ?? "",
			);
		});
	}

	return values;
}

function renderTemplateText(
	text: string,
	type: string,
	values: Map<string, string>,
) {
	return text.replace(PLACEHOLDER_REGEX, (match, index: string) => {
		const replacement = values.get(`${type}:${index}`);
		return replacement && replacement.length > 0 ? replacement : match;
	});
}

export function renderWhatsAppTemplateMessage({
	components,
	params,
}: {
	components: unknown;
	params: unknown;
}) {
	if (!Array.isArray(components)) {
		return null;
	}

	const values = getTemplateParameterValues(params);
	const parts: string[] = [];

	for (const component of components as TemplateComponent[]) {
		const type = component.type?.toUpperCase();
		if (!component.text) {
			continue;
		}

		if (type === "HEADER") {
			parts.push(renderTemplateText(component.text, "header", values));
			continue;
		}

		if (type === "BODY") {
			parts.push(renderTemplateText(component.text, "body", values));
			continue;
		}

		if (type === "FOOTER") {
			parts.push(component.text);
		}
	}

	return parts.length > 0 ? parts.join("\n\n") : null;
}
