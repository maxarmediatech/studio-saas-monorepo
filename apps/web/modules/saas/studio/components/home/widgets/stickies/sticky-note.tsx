"use client";

import { cn } from "@repo/ui/lib/utils";
import { Minimize2Icon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { STICKY_COLORS, type StickyColor } from "./constants";
import { StickyDeleteModal } from "./sticky-delete-modal";
import { StickyToolbar } from "./sticky-toolbar";
import { useStickiesMasonryLayout } from "./stickies-masonry";

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
	const [localContent, setLocalContent] = useState(sticky.content || "");
	const cardRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const lastSavedContentRef = useRef(sticky.content || "");
	const didAutoFocusRef = useRef(false);
	const requestMasonryLayout = useStickiesMasonryLayout();

	const colorConfig = STICKY_COLORS[sticky.color] || STICKY_COLORS.yellow;

	// Sync from props, but only skip if we have UNSAVED local changes while focused
	// This fixes the bug where server updates were blocked entirely during editing
	useEffect(() => {
		const next = sticky.content ?? "";
		const hasUnsavedChanges = localContent !== lastSavedContentRef.current;

		// Only skip sync if we're focused AND have unsaved changes
		// This allows server confirmations to sync while blocking overwrites of in-flight edits
		if (isFocused && hasUnsavedChanges) {
			return;
		}

		setLocalContent(next);
		lastSavedContentRef.current = next;
	}, [sticky.content]); // Note: removed isFocused and localContent from deps to avoid loops

	const flushPendingUpdate = useCallback(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
		if (localContent !== lastSavedContentRef.current) {
			lastSavedContentRef.current = localContent;
			onUpdate({ content: localContent });
		}
	}, [localContent, onUpdate]);

	const handleContentChange = useCallback(
		(value: string) => {
			setLocalContent(value);

			if (!autoSave) {
				return;
			}

			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}

			debounceRef.current = setTimeout(() => {
				debounceRef.current = null;
				lastSavedContentRef.current = value;
				onUpdate({ content: value });
			}, 500);
		},
		[autoSave, onUpdate],
	);

	const handleBlur = useCallback(() => {
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

	const adjustTextareaHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, []);

	useEffect(() => {
		adjustTextareaHeight();
	}, [localContent, adjustTextareaHeight]);

	useEffect(() => {
		if (!autoFocus) {
			return;
		}
		if (didAutoFocusRef.current) {
			return;
		}
		didAutoFocusRef.current = true;

		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}

		requestAnimationFrame(() => {
			textarea.focus();
			textarea.setSelectionRange(textarea.value.length, textarea.value.length);
			onAutoFocus?.();
		});
	}, [autoFocus, onAutoFocus]);

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
					<textarea
						ref={textareaRef}
						value={localContent}
						onChange={(e) => handleContentChange(e.target.value)}
						onBlur={handleBlur}
						placeholder="Click to type here..."
						className={cn(
							"w-full min-h-[180px] max-h-[400px] resize-none bg-transparent p-4 text-sm",
							"placeholder:text-foreground/40 focus:outline-none",
							"overflow-y-auto scrollbar-thin",
						)}
						rows={1}
					/>
				</div>

				{showToolbar && (
					<div
						className={cn(
							"px-4 pb-3 transition-all duration-200 ease-out origin-top",
							isFocused
								? "opacity-100"
								: "opacity-0 group-hover/sticky:opacity-100",
						)}
					>
						<StickyToolbar
							color={sticky.color}
							onColorChange={handleColorChange}
							onDelete={() => setIsDeleteModalOpen(true)}
						/>
					</div>
				)}
			</fieldset>
		</>
	);
}
