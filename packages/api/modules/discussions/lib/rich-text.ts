import type { EditorContentJson, ValidationResult } from "@repo/editor";
import {
	coerceContentJsonFromText,
	extractText,
	validateContentJson,
} from "@repo/editor/core";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface BuildRichTextArgs {
	content?: string | null;
	contentJson?: unknown;
	maxBytes?: number;
}

export interface BuildRichTextResult {
	json: EditorContentJson;
	text: string;
	validation: ValidationResult;
}

export function buildRichTextContent(args: BuildRichTextArgs): BuildRichTextResult {
	const { content, contentJson, maxBytes } = args;

	let json: EditorContentJson;
	if (isPlainObject(contentJson) && typeof contentJson.type === "string") {
		json = contentJson as unknown as EditorContentJson;
	} else {
		json = coerceContentJsonFromText(content ?? "");
	}

	const validation = validateContentJson({
		content: json,
		maxBytes,
	});

	const text = extractText(json);
	return { json, text, validation };
}
