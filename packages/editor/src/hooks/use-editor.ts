"use client";

import type { Extensions, JSONContent } from "@tiptap/core";
import { useEditor as useTiptapEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import {
	createBaseExtensions,
	createLiteExtensions,
} from "../schema/extensions";

export interface UseEditorOptions {
	initialContent?: JSONContent | null;
	placeholder?: string;
	editable?: boolean;
	autofocus?: boolean | "start" | "end";
	onUpdate?: (content: JSONContent) => void;
	onSubmit?: (content: JSONContent) => void;
	extensions?: Extensions;
	variant?: "lite" | "full";
}

export function useEditorInstance(options: UseEditorOptions = {}) {
	const {
		initialContent,
		placeholder = "Write something...",
		editable = true,
		autofocus = false,
		onUpdate,
		onSubmit,
		extensions: customExtensions,
		variant = "full",
	} = options;

	const onSubmitRef = useRef(onSubmit);
	onSubmitRef.current = onSubmit;

	const baseExtensions =
		variant === "lite"
			? createLiteExtensions(placeholder)
			: createBaseExtensions({ placeholder });

	const allExtensions = customExtensions
		? [...baseExtensions, ...customExtensions]
		: baseExtensions;

	const editor = useTiptapEditor({
		extensions: allExtensions,
		content: initialContent ?? undefined,
		editable,
		autofocus,
		editorProps: {
			attributes: {
				class: "editor-content prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[60px] px-3 py-2",
			},
			handleKeyDown: (view, event) => {
				if (
					event.key === "Enter" &&
					!event.shiftKey &&
					variant === "lite"
				) {
					event.preventDefault();
					const content = view.state.doc.toJSON() as JSONContent;
					onSubmitRef.current?.(content);
					return true;
				}
				return false;
			},
		},
		onUpdate: ({ editor: e }) => {
			const json = e.getJSON();
			onUpdate?.(json);
		},
	});

	useEffect(() => {
		if (editor && initialContent) {
			const currentContent = JSON.stringify(editor.getJSON());
			const newContent = JSON.stringify(initialContent);
			if (currentContent !== newContent) {
				editor.commands.setContent(initialContent);
			}
		}
	}, [editor, initialContent]);

	const clearContent = useCallback(() => {
		editor?.commands.clearContent();
	}, [editor]);

	const getContent = useCallback((): JSONContent | null => {
		return editor?.getJSON() ?? null;
	}, [editor]);

	const isEmpty = useCallback((): boolean => {
		return editor?.isEmpty ?? true;
	}, [editor]);

	const focus = useCallback(() => {
		editor?.commands.focus();
	}, [editor]);

	const submit = useCallback(() => {
		if (editor && !editor.isEmpty) {
			const content = editor.getJSON();
			onSubmitRef.current?.(content);
		}
	}, [editor]);

	return {
		editor,
		clearContent,
		getContent,
		isEmpty,
		focus,
		submit,
	};
}
