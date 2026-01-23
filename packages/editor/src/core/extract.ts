import type { EditorContentJson, EditorNode } from "./types";

function isTextNode(node: EditorNode): node is EditorNode & { type: "text"; text: string } {
	return node.type === "text" && typeof (node as any).text === "string";
}

function isBlockBoundary(nodeType: string): boolean {
	return (
		nodeType === "paragraph" ||
		nodeType === "heading" ||
		nodeType === "blockquote" ||
		nodeType === "listItem" ||
		nodeType === "taskItem" ||
		nodeType === "codeBlock"
	);
}

function extractTextFromNode(node: EditorNode, out: string[], depth: number): void {
	if (depth > 50) return;

	if (isTextNode(node)) {
		out.push(node.text);
		return;
	}

	if (node.type === "hardBreak") {
		out.push("\n");
		return;
	}

	const content = node.content;
	if (!Array.isArray(content) || content.length === 0) return;

	for (let i = 0; i < content.length; i++) {
		const child = content[i];
		if (!child) continue;
		extractTextFromNode(child, out, depth + 1);

		// If the child is a block boundary and not the last child, add newline.
		if (i !== content.length - 1 && isBlockBoundary(child.type)) {
			out.push("\n");
		}
	}
}

export function extractText(content: EditorContentJson): string {
	const parts: string[] = [];
	extractTextFromNode(content, parts, 0);

	// Normalize: collapse multiple newlines and trim trailing whitespace per line.
	const raw = parts.join("");
	return raw
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line, idx, arr) => {
			// Keep empty lines only if they separate content.
			if (line !== "") return true;
			return idx > 0 && idx < arr.length - 1;
		})
		.join("\n")
		.trim();
}
