import type {
	EditorContentJson,
	EditorLinkMark,
	EditorMark,
	EditorNode,
	ValidationError,
	ValidationResult,
} from "./types";

export interface ValidateContentJsonArgs {
	content: EditorContentJson;
	maxBytes?: number;
	maxDepth?: number;
	maxNodes?: number;
	allowedLinkProtocols?: readonly string[];
}

const DEFAULT_ALLOWED_NODE_TYPES = new Set([
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
	"hardBreak",
	"horizontalRule",
]);

const DEFAULT_ALLOWED_MARK_TYPES = new Set([
	"bold",
	"italic",
	"strike",
	"code",
	"link",
]);

const DEFAULT_ALLOWED_LINK_PROTOCOLS = ["http", "https", "mailto", "tel"] as const;

function addError(errors: ValidationError[], path: string, message: string): void {
	errors.push({ path, message });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateHref(
	href: unknown,
	path: string,
	errors: ValidationError[],
	allowedProtocols: readonly string[],
): void {
	if (typeof href !== "string") {
		addError(errors, path, "Link href must be a string");
		return;
	}

	const trimmed = href.trim();
	if (trimmed === "") {
		addError(errors, path, "Link href cannot be empty");
		return;
	}

	const lower = trimmed.toLowerCase();
	if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
		addError(errors, path, "Unsafe link protocol");
		return;
	}

	// Allow anchors and site-relative links.
	if (trimmed.startsWith("#") || trimmed.startsWith("/")) return;

	try {
		const url = new URL(trimmed);
		const protocol = url.protocol.replace(":", "");
		if (!allowedProtocols.includes(protocol)) {
			addError(errors, path, `Unsafe link protocol: ${protocol}`);
		}
	} catch {
		// If it's not a valid absolute URL, treat as invalid.
		addError(errors, path, "Invalid link href");
	}
}

function validateMarks(
	marks: EditorMark[] | undefined,
	path: string,
	errors: ValidationError[],
	allowedProtocols: readonly string[],
): void {
	if (marks === undefined) return;
	if (!Array.isArray(marks)) {
		addError(errors, path, "Marks must be an array");
		return;
	}

	for (let i = 0; i < marks.length; i++) {
		const mark = marks[i];
		const markPath = `${path}.marks[${i}]`;
		if (!isPlainObject(mark) || typeof mark.type !== "string") {
			addError(errors, markPath, "Mark must be an object with a string type");
			continue;
		}

		if (!DEFAULT_ALLOWED_MARK_TYPES.has(mark.type)) {
			addError(errors, markPath, `Unknown mark type: ${mark.type}`);
			continue;
		}

		if (mark.type === "link") {
			const link = mark as EditorLinkMark;
			validateHref(link.attrs?.href, `${markPath}.attrs.href`, errors, allowedProtocols);
		}
	}
}

function validateNode(
	node: EditorNode,
	path: string,
	errors: ValidationError[],
	state: { depth: number; nodes: number },
	limits: { maxDepth: number; maxNodes: number },
	allowedProtocols: readonly string[],
): void {
	state.nodes += 1;
	if (state.nodes > limits.maxNodes) {
		addError(errors, path, `Document exceeds max node count (${limits.maxNodes})`);
		return;
	}

	if (!DEFAULT_ALLOWED_NODE_TYPES.has(node.type)) {
		addError(errors, path, `Unknown node type: ${node.type}`);
		return;
	}

	if (state.depth > limits.maxDepth) {
		addError(errors, path, `Document exceeds max depth (${limits.maxDepth})`);
		return;
	}

	validateMarks(node.marks as EditorMark[] | undefined, path, errors, allowedProtocols);

	if (node.type === "text") {
		const text = (node as any).text;
		if (typeof text !== "string") {
			addError(errors, path, "Text node must have a string 'text' field");
		}
		if (node.content !== undefined) {
			addError(errors, path, "Text node must not have 'content'");
		}
		return;
	}

	if (node.content === undefined) return;
	if (!Array.isArray(node.content)) {
		addError(errors, path, "Node content must be an array");
		return;
	}

	for (let i = 0; i < node.content.length; i++) {
		const child = node.content[i];
		const childPath = `${path}.content[${i}]`;
		if (!isPlainObject(child) || typeof (child as any).type !== "string") {
			addError(errors, childPath, "Child node must be an object with a string type");
			continue;
		}
		validateNode(child as EditorNode, childPath, errors, { ...state, depth: state.depth + 1 }, limits, allowedProtocols);
	}
}

export function validateContentJson(args: ValidateContentJsonArgs): ValidationResult {
	const {
		content,
		maxBytes = 200 * 1024,
		maxDepth = 20,
		maxNodes = 5000,
		allowedLinkProtocols = DEFAULT_ALLOWED_LINK_PROTOCOLS,
	} = args;

	const errors: ValidationError[] = [];

	let bytes = 0;
	try {
		bytes = Buffer.byteLength(JSON.stringify(content), "utf8");
	} catch {
		addError(errors, "content", "Content is not JSON-serializable");
		return { ok: false, errors };
	}

	if (bytes > maxBytes) {
		addError(errors, "content", `Content exceeds max size (${maxBytes} bytes)`);
	}

	if (!isPlainObject(content) || typeof (content as any).type !== "string") {
		addError(errors, "content", "Content must be an object with a string type");
		return { ok: false, errors };
	}

	if (content.type !== "doc") {
		addError(errors, "content.type", "Root node must be 'doc'");
		return { ok: false, errors };
	}

	validateNode(
		content,
		"content",
		errors,
		{ depth: 0, nodes: 0 },
		{ maxDepth, maxNodes },
		allowedLinkProtocols,
	);

	return { ok: errors.length === 0, errors };
}
