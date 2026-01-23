export interface EditorMark {
	type: string;
	attrs?: Record<string, unknown>;
}

export interface EditorNode {
	type: string;
	attrs?: Record<string, unknown>;
	text?: string;
	content?: EditorNode[];
	marks?: EditorMark[];
}

export interface EditorTextNode extends EditorNode {
	type: "text";
	text: string;
}

export interface EditorLinkMark extends EditorMark {
	type: "link";
	attrs?: {
		href?: unknown;
		target?: unknown;
		rel?: unknown;
		[key: string]: unknown;
	};
}

export type EditorContentJson = EditorNode;

export interface ValidationError {
	message: string;
	path: string;
}

export interface ValidationResult {
	ok: boolean;
	errors: ValidationError[];
}
