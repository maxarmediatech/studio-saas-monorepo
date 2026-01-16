"use client";

import { cn } from "@repo/ui/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useImperativeHandle, forwardRef } from "react";

export interface StickyEditorRef {
	editor: Editor | null;
	focus: () => void;
}

interface StickyEditorProps {
	content: string;
	onChange: (html: string) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
}

export const StickyEditor = forwardRef<StickyEditorRef, StickyEditorProps>(
	function StickyEditor(
		{
			content,
			onChange,
			onFocus,
			onBlur,
			placeholder = "Click to type here...",
			className,
			autoFocus = false,
		},
		ref,
	) {
		const editor = useEditor({
			// Prevent SSR hydration mismatch - render only on client
			immediatelyRender: false,
			extensions: [
				StarterKit.configure({
					// Disable features we don't need for stickies
					heading: false,
					codeBlock: false,
					blockquote: false,
					horizontalRule: false,
					code: false,
				}),
				TaskList.configure({
					HTMLAttributes: {
						class: "sticky-task-list",
					},
				}),
				TaskItem.configure({
					nested: true,
					HTMLAttributes: {
						class: "sticky-task-item",
					},
				}),
				Placeholder.configure({
					placeholder,
					emptyEditorClass: "is-editor-empty",
				}),
			],
			content,
			editorProps: {
				attributes: {
					class: cn(
						"prose prose-sm max-w-none focus:outline-none",
						"min-h-[180px] max-h-[400px] overflow-y-auto",
						// Placeholder styles
						"[&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
						"[&_.is-editor-empty:first-child]:before:text-foreground/40",
						"[&_.is-editor-empty:first-child]:before:float-left",
						"[&_.is-editor-empty:first-child]:before:h-0",
						"[&_.is-editor-empty:first-child]:before:pointer-events-none",
						// Task list styles
						"[&_ul.sticky-task-list]:list-none [&_ul.sticky-task-list]:pl-0 [&_ul.sticky-task-list]:my-1",
						"[&_li.sticky-task-item]:flex [&_li.sticky-task-item]:items-start [&_li.sticky-task-item]:gap-2 [&_li.sticky-task-item]:my-0.5",
						"[&_li.sticky-task-item>label]:mt-0.5 [&_li.sticky-task-item>label]:flex-shrink-0",
						"[&_li.sticky-task-item>label>input]:size-4 [&_li.sticky-task-item>label>input]:accent-primary",
						"[&_li.sticky-task-item[data-checked=true]>div]:line-through [&_li.sticky-task-item[data-checked=true]>div]:opacity-60",
						// Paragraph spacing
						"[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
					),
				},
				handleDOMEvents: {
					focus: () => {
						onFocus?.();
						return false;
					},
					blur: () => {
						onBlur?.();
						return false;
					},
				},
			},
			onUpdate: ({ editor }) => {
				onChange(editor.getHTML());
			},
		});

		// Expose editor and focus method to parent
		useImperativeHandle(ref, () => ({
			editor,
			focus: () => {
				editor?.chain().focus().run();
			},
		}));

		// Handle autoFocus
		useEffect(() => {
			if (autoFocus && editor) {
				// Small delay to ensure editor is fully mounted
				requestAnimationFrame(() => {
					editor.chain().focus().run();
				});
			}
		}, [autoFocus, editor]);

		// Sync external content changes (e.g., from server)
		useEffect(() => {
			if (!editor) return;

			const currentContent = editor.getHTML();
			// Only update if content actually differs (prevents cursor jumps)
			if (content !== currentContent) {
				// Preserve selection position if possible
				const { from, to } = editor.state.selection;
				editor.commands.setContent(content, { emitUpdate: false });

				// Try to restore selection if it's still valid
				const docLength = editor.state.doc.content.size;
				if (from <= docLength && to <= docLength) {
					editor.commands.setTextSelection({ from, to });
				}
			}
		}, [content, editor]);

		if (!editor) {
			return null;
		}

		return (
			<EditorContent
				editor={editor}
				className={cn("sticky-editor w-full p-4 text-sm", className)}
			/>
		);
	},
);
