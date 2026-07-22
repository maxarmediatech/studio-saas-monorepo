"use client";

import { cn } from "@repo/ui/lib/utils";
import { Minimize2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { STICKY_COLORS, type StickyColor } from "./constants";
import { useStickiesMasonryLayout } from "./stickies-masonry";
import { StickyDeleteModal } from "./sticky-delete-modal";
import { StickyEditor, type StickyEditorRef } from "./sticky-editor";
import { StickyFormatToolbar } from "./sticky-format-toolbar";
import { StickyToolbar } from "./sticky-toolbar";

export interface StickyData {
	id?: string;
	title?: string | null;
	content?: string | null;
	descriptionHtml?: string | null;
	color: StickyColor;
}

interface StickyNoteProps {
	sticky: StickyData;
	onUpdate: (data: Partial<StickyData>) => void;
	onDelete?: () => void;
	onClose?: () => void;
	isDeleting?: boolean;
	showToolbar?: boolean;
	autoSave?: boolean;
	autoFocus?: boolean;
	onAutoFocus?: () => void;
	className?: string;
}

/**
 * Converts plain text content to HTML for the editor.
 * Used for migrating existing stickies that only have `content` (plain text).
 */
function migrateToHtml(sticky: StickyData): string {
	// If we already have HTML content, use it
	if (sticky.descriptionHtml) {
		return sticky.descriptionHtml;
	}

	// If we have plain text content, wrap each line in a paragraph
	if (sticky.content) {
		return sticky.content
			.split("\n")
			.map((line) => `<p>${line || "<br>"}</p>`)
			.join("");
	}

	// Empty sticky
	return "";
}

export function StickyNote({
	sticky,
	onUpdate,
	onDelete,
	onClose,
	isDeleting,
	showToolbar = true,
	autoSave = true,
	autoFocus = false,
	onAutoFocus,
	className,
}: StickyNoteProps) {
	const [isFocused, setIsFocused] = useState(false);
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [localHtml, setLocalHtml] = useState(() => migrateToHtml(sticky));
	const cardRef = useRef<HTMLFieldSetElement>(null);
	const editorRef = useRef<StickyEditorRef>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedHtmlRef = useRef(localHtml);
	const didAutoFocusRef = useRef(false);
	const requestMasonryLayout = useStickiesMasonryLayout();

	const colorConfig = STICKY_COLORS[sticky.color] || STICKY_COLORS.yellow;

	// Sync from props when server confirms updates
	useEffect(() => {
		const hasUnsavedChanges = localHtml !== lastSavedHtmlRef.current;

		// Only skip sync if we're focused AND have unsaved changes
		if (isFocused && hasUnsavedChanges) {
			return;
		}

		// Re-migrate in case content changed but descriptionHtml didn't
		const migrated = migrateToHtml(sticky);
		setLocalHtml(migrated);
		lastSavedHtmlRef.current = migrated;
	}, [sticky.descriptionHtml, sticky.content]);

	const flushPendingUpdate = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		if (localHtml !== lastSavedHtmlRef.current) {
			lastSavedHtmlRef.current = localHtml;
			onUpdate({ descriptionHtml: localHtml });
		}
	}, [localHtml, onUpdate]);

	const handleHtmlChange = useCallback(
		(html: string) => {
			setLocalHtml(html);

			if (!autoSave) {
				return;
			}

			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			debounceRef.current = setTimeout(() => {
				debounceRef.current = null;
				lastSavedHtmlRef.current = html;
				onUpdate({ descriptionHtml: html });
			}, 500);
		},
		[autoSave, onUpdate],
	);

	const handleEditorBlur = useCallback(() => {
		flushPendingUpdate();
	}, [flushPendingUpdate]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, []);

	const handleColorChange = useCallback(
		(color: StickyColor) => {
			onUpdate({ color });
		},
		[onUpdate],
	);

	const handleDelete = useCallback(() => {
		setIsDeleteModalOpen(false);
		onDelete?.();
	}, [onDelete]);

	// Handle autoFocus
	useEffect(() => {
		if (!autoFocus) {
			return;
		}
		if (didAutoFocusRef.current) {
			return;
		}
		didAutoFocusRef.current = true;

		requestAnimationFrame(() => {
			editorRef.current?.focus();
			onAutoFocus?.();
		});
	}, [autoFocus, onAutoFocus]);

	// Trigger masonry layout on resize
	useEffect(() => {
		const element = cardRef.current;
		if (!element) {
			return;
		}
		if (!requestMasonryLayout) {
			return;
		}

		const resizeObserver = new ResizeObserver(() => {
			requestMasonryLayout();
		});

		resizeObserver.observe(element);
		return () => resizeObserver.disconnect();
	}, [requestMasonryLayout]);

	return (
		<>
			<StickyDeleteModal
				isOpen={isDeleteModalOpen}
				onClose={() => setIsDeleteModalOpen(false)}
				onConfirm={handleDelete}
				isDeleting={isDeleting}
			/>

			<fieldset
				ref={cardRef}
				aria-label="Sticky note"
				className={cn(
					"w-full h-fit flex flex-col rounded-lg group/sticky overflow-hidden transition-shadow",
					"border-0 p-0 m-0",
					"hover:shadow-md",
					className,
				)}
				style={{ backgroundColor: colorConfig.backgroundColor }}
				onFocus={() => setIsFocused(true)}
				onBlur={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget)) {
						setIsFocused(false);
					}
				}}
			>
				{onClose && (
					<button
						type="button"
						className="flex-shrink-0 flex justify-end p-2.5"
						onClick={onClose}
						aria-label="Close sticky note"
					>
						<Minimize2Icon className="size-4 text-foreground/50 hover:text-foreground/70" />
					</button>
				)}

				<div className={cn("flex-1", onClose ? "-mt-2" : "")}>
					<StickyEditor
						ref={editorRef}
						content={localHtml}
						onChange={handleHtmlChange}
						onFocus={() => setIsFocused(true)}
						onBlur={handleEditorBlur}
						autoFocus={autoFocus && !didAutoFocusRef.current}
					/>
				</div>

				{showToolbar && (
					<div className="px-4 pb-3 mt-auto">
						<div className="flex items-center gap-4">
							<StickyToolbar
								color={sticky.color}
								onColorChange={handleColorChange}
								onDelete={() => setIsDeleteModalOpen(true)}
								formatToolbar={
									<StickyFormatToolbar
										editor={
											editorRef.current?.editor ?? null
										}
									/>
								}
							/>
						</div>
					</div>
				)}
			</fieldset>
		</>
	);
}
