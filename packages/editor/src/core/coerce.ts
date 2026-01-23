import type { EditorContentJson, EditorNode } from "./types";

function createParagraphFromLine(line: string): EditorNode {
	const trimmed = line;
	if (trimmed === "") {
		return { type: "paragraph", content: [] };
	}

	return {
		type: "paragraph",
		content: [{ type: "text", text: trimmed }],
	};
}

export function coerceContentJsonFromText(text: string | null | undefined): EditorContentJson {
	const normalized = (text ?? "").replace(/\r\n/g, "\n");
	if (normalized === "") return { type: "doc", content: [] };

	const lines = normalized.split("\n");
	return {
		type: "doc",
		content: lines.map(createParagraphFromLine),
	};
}
