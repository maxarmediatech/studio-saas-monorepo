"use client";

import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import React, { useEffect, useRef } from "react";

import "../styles/editor.css";

import type { EditorContentJson } from "../core/types";

export interface ReadOnlyRendererProps {
	content: EditorContentJson;
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

export function ReadOnlyRenderer({
	content,
	className,
	"data-testid": dataTestId = "read-only-renderer",
}: ReadOnlyRendererProps) {
	const lastSyncedValueRef = useRef<string>(safeStringify(content));

	const editor = useEditor({
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editable: false,
		extensions: [
			StarterKit.configure({
				link: false,
			}),
			Link.configure({
				openOnClick: true,
				linkOnPaste: false,
			}),
			TaskList,
			TaskItem.configure({ nested: true }),
		],
		content,
		editorProps: {
			attributes: {
				"data-testid": dataTestId,
				class: className ?? "",
			},
		},
	});

	useEffect(() => {
		if (!editor) return;
		const next = safeStringify(content);
		if (next === lastSyncedValueRef.current) return;
		editor.commands.setContent(content, { emitUpdate: false });
		lastSyncedValueRef.current = next;
	}, [editor, content]);

	if (!editor) return null;
	return <EditorContent editor={editor} />;
}
