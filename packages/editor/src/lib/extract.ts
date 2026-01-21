import type { JSONContent } from "@tiptap/core";
import type { ExtractedMention } from "../types/mention";

export function extractMentions(
	json: JSONContent | null | undefined,
): ExtractedMention[] {
	if (!json) return [];

	const mentions: ExtractedMention[] = [];
	traverseAndExtractMentions(json, mentions);

	const uniqueMentions = mentions.filter(
		(mention, index, self) =>
			index === self.findIndex((m) => m.userId === mention.userId),
	);

	return uniqueMentions;
}

function traverseAndExtractMentions(
	node: JSONContent,
	mentions: ExtractedMention[],
): void {
	if (node.type === "mention" && node.attrs?.id) {
		mentions.push({
			userId: node.attrs.id as string,
			label: (node.attrs.label as string) ?? "",
		});
	}

	if (node.content) {
		for (const child of node.content) {
			traverseAndExtractMentions(child, mentions);
		}
	}
}

export function extractLinks(json: JSONContent | null | undefined): string[] {
	if (!json) return [];

	const links: string[] = [];
	traverseAndExtractLinks(json, links);

	return [...new Set(links)];
}

function traverseAndExtractLinks(node: JSONContent, links: string[]): void {
	if (node.marks) {
		for (const mark of node.marks) {
			if (mark.type === "link" && mark.attrs?.href) {
				links.push(mark.attrs.href as string);
			}
		}
	}

	if (node.content) {
		for (const child of node.content) {
			traverseAndExtractLinks(child, links);
		}
	}
}

export function hasContent(json: JSONContent | null | undefined): boolean {
	if (!json) return false;
	if (!json.content || json.content.length === 0) return false;

	for (const node of json.content) {
		if (nodeHasContent(node)) return true;
	}

	return false;
}

function nodeHasContent(node: JSONContent): boolean {
	if (node.type === "text" && node.text && node.text.trim().length > 0) {
		return true;
	}

	if (node.type === "mention") {
		return true;
	}

	if (node.type === "horizontalRule" || node.type === "hardBreak") {
		return true;
	}

	if (node.content) {
		for (const child of node.content) {
			if (nodeHasContent(child)) return true;
		}
	}

	return false;
}
