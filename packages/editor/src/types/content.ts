import type { JSONContent } from "@tiptap/core";

export type { JSONContent };

export interface EditorDocument {
	type: "doc";
	content: JSONContent[];
}

export interface TextNode {
	type: "text";
	text: string;
	marks?: Array<{
		type: string;
		attrs?: Record<string, unknown>;
	}>;
}

export interface ParagraphNode {
	type: "paragraph";
	content?: JSONContent[];
}

export interface HeadingNode {
	type: "heading";
	attrs: {
		level: 1 | 2 | 3 | 4 | 5 | 6;
	};
	content?: JSONContent[];
}

export interface MentionNode {
	type: "mention";
	attrs: {
		id: string;
		label: string;
	};
}

export interface BulletListNode {
	type: "bulletList";
	content: ListItemNode[];
}

export interface OrderedListNode {
	type: "orderedList";
	content: ListItemNode[];
}

export interface TaskListNode {
	type: "taskList";
	content: TaskItemNode[];
}

export interface ListItemNode {
	type: "listItem";
	content: JSONContent[];
}

export interface TaskItemNode {
	type: "taskItem";
	attrs: {
		checked: boolean;
	};
	content: JSONContent[];
}

export interface BlockquoteNode {
	type: "blockquote";
	content: JSONContent[];
}

export interface CodeBlockNode {
	type: "codeBlock";
	attrs?: {
		language?: string;
	};
	content?: TextNode[];
}

export interface HorizontalRuleNode {
	type: "horizontalRule";
}

export interface LinkMark {
	type: "link";
	attrs: {
		href: string;
		target?: string;
		rel?: string;
	};
}

export type AllowedNodeType =
	| "doc"
	| "paragraph"
	| "text"
	| "heading"
	| "bulletList"
	| "orderedList"
	| "listItem"
	| "taskList"
	| "taskItem"
	| "blockquote"
	| "codeBlock"
	| "code"
	| "horizontalRule"
	| "hardBreak"
	| "mention";

export type AllowedMarkType =
	| "bold"
	| "italic"
	| "underline"
	| "strike"
	| "code"
	| "link";

export const ALLOWED_NODE_TYPES: AllowedNodeType[] = [
	"doc",
	"paragraph",
	"text",
	"heading",
	"bulletList",
	"orderedList",
	"listItem",
	"taskList",
	"taskItem",
	"blockquote",
	"codeBlock",
	"code",
	"horizontalRule",
	"hardBreak",
	"mention",
];

export const ALLOWED_MARK_TYPES: AllowedMarkType[] = [
	"bold",
	"italic",
	"underline",
	"strike",
	"code",
	"link",
];
