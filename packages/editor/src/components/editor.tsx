"use client";

import type { Extensions, JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { forwardRef, useImperativeHandle } from "react";
import { useEditorInstance } from "../hooks/use-editor";

function cn(...classes: (string | boolean | undefined)[]) {
	return classes.filter(Boolean).join(" ");
}

export interface EditorHandle {
	clearContent: () => void;
	getContent: () => JSONContent | null;
	isEmpty: () => boolean;
	focus: () => void;
	submit: () => void;
}

export interface EditorComponentProps {
	initialContent?: JSONContent | null;
	placeholder?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	onUpdate?: (content: JSONContent) => void;
	onSubmit?: (content: JSONContent) => void;
	extensions?: Extensions;
	className?: string;
	minHeight?: string;
}

export const Editor = forwardRef<EditorHandle, EditorComponentProps>(
	function Editor(
		{
			initialContent,
			placeholder = "Write something...",
			disabled = false,
			autoFocus = false,
			onUpdate,
			onSubmit,
			extensions,
			className,
			minHeight = "120px",
		},
		ref,
	) {
		const { editor, clearContent, getContent, isEmpty, focus, submit } =
			useEditorInstance({
				initialContent,
				placeholder,
				editable: !disabled,
				autofocus: autoFocus ? "end" : false,
				onUpdate,
				onSubmit,
				extensions,
				variant: "full",
			});

		useImperativeHandle(ref, () => ({
			clearContent,
			getContent,
			isEmpty,
			focus,
			submit,
		}));

		return (
			<div
				className={cn(
					"editor relative rounded-md border border-input bg-background",
					disabled && "opacity-50 cursor-not-allowed",
					className,
				)}
				style={{ minHeight }}
			>
				<EditorContent editor={editor} className="h-full" />
			</div>
		);
	},
);
