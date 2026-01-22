"use client";

import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import "../styles/editor.css";

import { extractText } from "../core/extract";
import type { EditorContentJson } from "../core/types";

export interface LiteRichTextEditorRef {
	editor: Editor | null;
	focus: () => void;
}

export interface LiteRichTextEditorProps {
	value: EditorContentJson;
	onChange: (payload: {
		json: EditorContentJson;
		html: string;
		text: string;
	}) => void;
	onSubmit: (payload: {
		json: EditorContentJson;
		html: string;
		text: string;
	}) => void;
	editable?: boolean;
	placeholder?: string;
	className?: string;
	"data-testid"?: string;
}

function safeStringify(value: unknown): string {
	try {
		return JSON.stringify(value);
	} catch {
		return "";
	}
}

export const LiteRichTextEditor = forwardRef<LiteRichTextEditorRef, LiteRichTextEditorProps>(
	function LiteRichTextEditor(
		{
			value,
			onChange,
			onSubmit,
			editable = true,
			placeholder,
			className,
			"data-testid": dataTestId = "lite-rich-text-editor",
		},
		ref,
	) {
		const lastSyncedValueRef = useRef<string>(safeStringify(value));

		const editor = useEditor({
			immediatelyRender: false,
			shouldRerenderOnTransaction: false,
			editable,
			extensions: [
				StarterKit.configure({
					link: false,
				}),
				Link.configure({
					openOnClick: false,
					linkOnPaste: true,
				}),
				TaskList,
				TaskItem.configure({ nested: true }),
				Placeholder.configure({
					placeholder: placeholder ?? "",
				}),
			],
			content: value,
			editorProps: {
				attributes: {
					"data-testid": dataTestId,
					class: className ?? "",
				},
				handleKeyDown: (_view, event) => {
					// Submit on Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
					if (event.key !== "Enter") return false;
					if (!event.metaKey && !event.ctrlKey) return false;

					// Avoid submitting while IME composition is active.
					const isComposing = (event as any).isComposing === true || (event as any).keyCode === 229;
					if (isComposing) return false;

					event.preventDefault();
					event.stopPropagation();

					const json = editor?.getJSON() as unknown as EditorContentJson;
					const html = editor?.getHTML() ?? "";
					const text = extractText(json);
					onSubmit({ json, html, text });
					return true;
				},
			},
			onUpdate: ({ editor: updatedEditor }) => {
				const json = updatedEditor.getJSON() as unknown as EditorContentJson;
				const html = updatedEditor.getHTML();
				const text = extractText(json);
				lastSyncedValueRef.current = safeStringify(json);
				onChange({ json, html, text });
			},
		});

		useImperativeHandle(
			ref,
			(): LiteRichTextEditorRef => ({
				editor,
				focus: () => {
					editor?.chain().focus().run();
				},
			}),
			[editor],
		);

		useEffect(() => {
			if (!editor) return;
			const next = safeStringify(value);
			if (next === lastSyncedValueRef.current) return;

			const { from, to } = editor.state.selection;
			editor.commands.setContent(value, { emitUpdate: false });
			const docSize = editor.state.doc.content.size;
			if (from <= docSize && to <= docSize) {
				editor.commands.setTextSelection({ from, to });
			}

			lastSyncedValueRef.current = next;
		}, [editor, value]);

		if (!editor) return null;
		return <EditorContent editor={editor} />;
	},
);
