"use client";

function cn(...classes: (string | boolean | undefined)[]) {
	return classes.filter(Boolean).join(" ");
}

import type { Extensions, JSONContent } from "@tiptap/core";
import { useMemo } from "react";
import { renderJsonToHtml } from "../lib/render";
import { sanitizeHtml } from "../lib/sanitize";
import { createBaseExtensions } from "../schema/extensions";

export interface ReadOnlyRendererProps {
	/** JSON content to render */
	content: JSONContent | null | undefined;
	/** Custom extensions for rendering (uses base extensions if not provided) */
	extensions?: Extensions;
	/** Additional CSS class names */
	className?: string;
	/** Whether to apply prose styling (default: true) */
	prose?: boolean;
	/** Variant for styling context */
	variant?: "default" | "compact" | "preview";
}

/**
 * ReadOnlyRenderer - SSR-safe component for rendering TipTap JSON content
 *
 * Renders ProseMirror JSON content to sanitized HTML for display.
 * Uses the same extensions as the editor to ensure consistent rendering.
 *
 * @example
 * ```tsx
 * <ReadOnlyRenderer content={discussion.contentJson} />
 * ```
 */
export function ReadOnlyRenderer({
	content,
	extensions,
	className,
	prose = true,
	variant = "default",
}: ReadOnlyRendererProps) {
	const html = useMemo(() => {
		if (!content) return "";

		const exts = extensions ?? createBaseExtensions();
		const rawHtml = renderJsonToHtml(content, exts);
		return sanitizeHtml(rawHtml);
	}, [content, extensions]);

	if (!html) {
		return null;
	}

	return (
		<div
			className={cn(
				"editor-content",
				prose && "prose prose-sm dark:prose-invert max-w-none",
				variant === "compact" && "prose-compact",
				variant === "preview" && "prose-preview line-clamp-3",
				className,
			)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is sanitized via sanitizeHtml
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
