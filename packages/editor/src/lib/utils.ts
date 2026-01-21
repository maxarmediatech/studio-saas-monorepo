import type { JSONContent } from "@tiptap/core";

export function createEmptyDocument(): JSONContent {
	return {
		type: "doc",
		content: [
			{
				type: "paragraph",
			},
		],
	};
}

export function createDocumentFromText(text: string): JSONContent {
	if (!text || text.trim().length === 0) {
		return createEmptyDocument();
	}

	const paragraphs = text.split(/\n\n+/).map((paragraph) => ({
		type: "paragraph" as const,
		content: paragraph
			.split(/\n/)
			.flatMap((line, index, array) => {
				const nodes: JSONContent[] = [];
				if (line.trim().length > 0) {
					nodes.push({ type: "text", text: line });
				}
				if (index < array.length - 1) {
					nodes.push({ type: "hardBreak" });
				}
				return nodes;
			})
			.filter(
				(node) =>
					node.type === "hardBreak" ||
					(node.type === "text" && node.text),
			),
	}));

	return {
		type: "doc",
		content: paragraphs.length > 0 ? paragraphs : [{ type: "paragraph" }],
	};
}

export function isEmptyDocument(json: JSONContent | null | undefined): boolean {
	if (!json) return true;
	if (!json.content || json.content.length === 0) return true;

	for (const node of json.content) {
		if (node.type === "paragraph") {
			if (node.content && node.content.length > 0) {
				for (const child of node.content) {
					if (
						child.type === "text" &&
						child.text &&
						child.text.trim().length > 0
					) {
						return false;
					}
					if (child.type === "mention") {
						return false;
					}
				}
			}
		} else {
			return false;
		}
	}

	return true;
}

export function getWordCount(json: JSONContent | null | undefined): number {
	if (!json) return 0;

	let text = "";
	extractText(json, (t) => {
		text += t + " ";
	});

	return text.trim().split(/\s+/).filter(Boolean).length;
}

export function getCharacterCount(
	json: JSONContent | null | undefined,
): number {
	if (!json) return 0;

	let count = 0;
	extractText(json, (t) => {
		count += t.length;
	});

	return count;
}

function extractText(
	node: JSONContent,
	callback: (text: string) => void,
): void {
	if (node.type === "text" && node.text) {
		callback(node.text);
	}

	if (node.type === "mention" && node.attrs?.label) {
		callback(`@${node.attrs.label}`);
	}

	if (node.content) {
		for (const child of node.content) {
			extractText(child, callback);
		}
	}
}
