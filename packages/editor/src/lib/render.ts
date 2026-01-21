import type { Extensions, JSONContent } from "@tiptap/core";
import { generateHTML } from "@tiptap/html";
import { createBaseExtensions } from "../schema/extensions";

export function renderJsonToHtml(
	json: JSONContent | null | undefined,
	extensions?: Extensions,
): string {
	if (!json) return "";

	try {
		const exts = extensions ?? createBaseExtensions();
		return generateHTML(json, exts);
	} catch (error) {
		console.error("Failed to render JSON to HTML:", error);
		return "";
	}
}

export function renderJsonToText(json: JSONContent | null | undefined): string {
	if (!json) return "";

	try {
		return extractTextFromJson(json);
	} catch (error) {
		console.error("Failed to render JSON to text:", error);
		return "";
	}
}

function extractTextFromJson(node: JSONContent): string {
	if (node.type === "text") {
		return node.text ?? "";
	}

	if (node.type === "mention") {
		return `@${node.attrs?.label ?? ""}`;
	}

	if (node.type === "hardBreak") {
		return "\n";
	}

	if (node.type === "paragraph" || node.type === "heading") {
		const text = node.content?.map(extractTextFromJson).join("") ?? "";
		return text + "\n";
	}

	if (
		node.type === "bulletList" ||
		node.type === "orderedList" ||
		node.type === "taskList"
	) {
		return node.content?.map(extractTextFromJson).join("") ?? "";
	}

	if (node.type === "listItem" || node.type === "taskItem") {
		const prefix =
			node.type === "taskItem"
				? node.attrs?.checked
					? "[x] "
					: "[ ] "
				: "• ";
		const text = node.content?.map(extractTextFromJson).join("") ?? "";
		return prefix + text;
	}

	if (node.type === "blockquote") {
		const text = node.content?.map(extractTextFromJson).join("") ?? "";
		return text
			.split("\n")
			.map((line) => `> ${line}`)
			.join("\n");
	}

	if (node.type === "codeBlock") {
		return node.content?.map(extractTextFromJson).join("") ?? "";
	}

	if (node.content) {
		return node.content.map(extractTextFromJson).join("");
	}

	return "";
}

export function truncateText(text: string, maxLength: number): string {
	if (text.length <= maxLength) return text;
	return text.slice(0, maxLength).trim() + "...";
}

export function getPreviewText(
	json: JSONContent | null | undefined,
	maxLength = 150,
): string {
	const text = renderJsonToText(json);
	const singleLine = text.replace(/\n+/g, " ").trim();
	return truncateText(singleLine, maxLength);
}
