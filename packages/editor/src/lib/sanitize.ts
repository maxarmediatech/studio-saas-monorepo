import type { JSONContent } from "@tiptap/core";
import type { AllowedMarkType, AllowedNodeType } from "../types/content";
import { ALLOWED_MARK_TYPES, ALLOWED_NODE_TYPES } from "../types/content";

const MAX_DOCUMENT_SIZE = 100 * 1024;
const MAX_NESTING_DEPTH = 10;
const BLOCKED_URL_PROTOCOLS = ["javascript:", "data:", "vbscript:"];

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	sanitized?: JSONContent;
}

export function validateAndSanitizeJson(json: unknown): ValidationResult {
	const errors: string[] = [];

	if (!json || typeof json !== "object") {
		return { valid: false, errors: ["Invalid JSON: not an object"] };
	}

	const jsonString = JSON.stringify(json);
	if (jsonString.length > MAX_DOCUMENT_SIZE) {
		return {
			valid: false,
			errors: [
				`Document size exceeds maximum of ${MAX_DOCUMENT_SIZE} bytes`,
			],
		};
	}

	const doc = json as JSONContent;

	if (doc.type !== "doc") {
		return { valid: false, errors: ["Root node must be of type 'doc'"] };
	}

	const sanitized = sanitizeNode(doc, 0, errors);

	return {
		valid: errors.length === 0,
		errors,
		sanitized,
	};
}

function sanitizeNode(
	node: JSONContent,
	depth: number,
	errors: string[],
): JSONContent {
	if (depth > MAX_NESTING_DEPTH) {
		errors.push(`Maximum nesting depth of ${MAX_NESTING_DEPTH} exceeded`);
		return { type: "paragraph" };
	}

	if (!ALLOWED_NODE_TYPES.includes(node.type as AllowedNodeType)) {
		errors.push(`Unknown node type: ${node.type}`);
		return { type: "paragraph" };
	}

	const sanitized: JSONContent = { type: node.type };

	if (node.attrs && node.type) {
		sanitized.attrs = sanitizeAttrs(node.type, node.attrs, errors);
	}

	if (node.marks) {
		sanitized.marks = node.marks
			.filter((mark) => {
				if (
					!ALLOWED_MARK_TYPES.includes(mark.type as AllowedMarkType)
				) {
					errors.push(`Unknown mark type: ${mark.type}`);
					return false;
				}
				return true;
			})
			.map((mark) => sanitizeMark(mark, errors));
	}

	if (node.text !== undefined) {
		sanitized.text = node.text;
	}

	if (node.content) {
		sanitized.content = node.content.map((child) =>
			sanitizeNode(child, depth + 1, errors),
		);
	}

	return sanitized;
}

function sanitizeAttrs(
	nodeType: string,
	attrs: Record<string, unknown>,
	errors: string[],
): Record<string, unknown> {
	const sanitized: Record<string, unknown> = {};

	switch (nodeType) {
		case "heading":
			if (
				typeof attrs.level === "number" &&
				attrs.level >= 1 &&
				attrs.level <= 6
			) {
				sanitized.level = attrs.level;
			} else {
				sanitized.level = 1;
			}
			break;

		case "mention":
			if (typeof attrs.id === "string") {
				sanitized.id = attrs.id;
			}
			if (typeof attrs.label === "string") {
				sanitized.label = attrs.label.slice(0, 100);
			}
			break;

		case "taskItem":
			sanitized.checked = Boolean(attrs.checked);
			break;

		case "codeBlock":
			if (typeof attrs.language === "string") {
				sanitized.language = attrs.language.slice(0, 50);
			}
			break;

		default:
			break;
	}

	return sanitized;
}

function sanitizeMark(
	mark: { type: string; attrs?: Record<string, unknown> },
	errors: string[],
): { type: string; attrs?: Record<string, unknown> } {
	const sanitized: { type: string; attrs?: Record<string, unknown> } = {
		type: mark.type,
	};

	if (mark.type === "link" && mark.attrs) {
		const href = mark.attrs.href;
		if (typeof href === "string") {
			if (isValidUrl(href)) {
				sanitized.attrs = {
					href,
					target: "_blank",
					rel: "noopener noreferrer",
				};
			} else {
				errors.push(`Invalid or blocked URL: ${href}`);
			}
		}
	}

	return sanitized;
}

function isValidUrl(url: string): boolean {
	try {
		const parsed = new URL(url);

		for (const protocol of BLOCKED_URL_PROTOCOLS) {
			if (parsed.protocol.toLowerCase() === protocol) {
				return false;
			}
		}

		return parsed.protocol === "http:" || parsed.protocol === "https:";
	} catch {
		return false;
	}
}

export function sanitizeHtml(html: string): string {
	if (typeof window === "undefined") {
		return html
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
			.replace(/on\w+\s*=/gi, "data-removed=")
			.replace(/javascript:/gi, "");
	}

	try {
		const DOMPurify = require("dompurify");
		return DOMPurify.sanitize(html, {
			ALLOWED_TAGS: [
				"p",
				"br",
				"strong",
				"b",
				"em",
				"i",
				"u",
				"s",
				"strike",
				"code",
				"pre",
				"blockquote",
				"h1",
				"h2",
				"h3",
				"h4",
				"h5",
				"h6",
				"ul",
				"ol",
				"li",
				"a",
				"hr",
				"span",
				"div",
			],
			ALLOWED_ATTR: [
				"href",
				"target",
				"rel",
				"class",
				"data-type",
				"data-id",
				"data-label",
			],
			ALLOW_DATA_ATTR: true,
		});
	} catch {
		return html
			.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
			.replace(/on\w+\s*=/gi, "data-removed=")
			.replace(/javascript:/gi, "");
	}
}
