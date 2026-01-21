"use client";

import type { JSONContent } from "@tiptap/core";
import { EditorContent } from "@tiptap/react";
import { Send } from "lucide-react";
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
				"lite-editor group relative flex min-h-[96px] w-full flex-col rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<EditorContent editor={editor} className="flex-1" />
			{!disabled && (
				<div className="mt-2 flex items-center justify-between pt-2 opacity-50 transition-opacity duration-200 group-focus-within:opacity-100">
					<div className="flex items-center gap-2 text-muted-foreground select-none">
						<span className="text-lg leading-none font-light">
							/
						</span>
					</div>
					<button
						type="button"
						onClick={submit}
						className="rounded-full p-1 text-primary hover:bg-primary/10 transition-colors"
					>
						<Send className="size-4" />
					</button>
				</div>
			)}
		</div>
	);
});
