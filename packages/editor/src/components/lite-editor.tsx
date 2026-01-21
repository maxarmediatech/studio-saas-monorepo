"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { forwardRef, useImperativeHandle } from "react";
import { useEditorInstance } from "../hooks/use-editor";

function cn(...classes: (string | boolean | undefined)[]) {
	return classes.filter(Boolean).join(" ");
}

export interface LiteEditorHandle {
	clearContent: () => void;
	getContent: () => JSONContent | null;
	isEmpty: () => boolean;
	focus: () => void;
	submit: () => void;
}

export interface LiteEditorComponentProps {
	initialContent?: JSONContent | null;
	placeholder?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	onUpdate?: (content: JSONContent) => void;
	onSubmit?: (content: JSONContent) => void;
	className?: string;
}

export const LiteEditor = forwardRef<
	LiteEditorHandle,
	LiteEditorComponentProps
>(function LiteEditor(
	{
		initialContent,
		placeholder = "Write a message...",
		disabled = false,
		autoFocus = false,
		onUpdate,
		onSubmit,
		className,
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
			variant: "lite",
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
				"lite-editor relative rounded-md border border-input bg-background",
				disabled && "opacity-50 cursor-not-allowed",
				className,
			)}
		>
			<EditorContent editor={editor} />
			{!disabled && (
				<div className="absolute bottom-1 right-2 text-xs text-muted-foreground pointer-events-none">
					Enter to send
				</div>
			)}
		</div>
	);
});
