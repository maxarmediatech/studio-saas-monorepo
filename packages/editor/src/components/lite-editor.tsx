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
	variant?: "default" | "borderless";
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
		variant = "default",
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

	const isBorderless = variant === "borderless";

	return (
		<div
			className={cn(
				"lite-editor group relative flex w-full flex-col text-sm",
				!isBorderless &&
					"min-h-[96px] rounded-md border border-input bg-transparent px-3 py-2 ring-offset-background focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
				isBorderless && "min-h-[40px]",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<EditorContent editor={editor} className="flex-1" />
			{!disabled && (
				<div className="mt-1 flex items-center justify-between text-muted-foreground">
					<span className="text-base leading-none font-light select-none">
						/
					</span>
					<button
						type="button"
						onClick={submit}
						className="p-1 hover:text-primary transition-colors cursor-pointer"
					>
						<Send className="size-4" />
					</button>
				</div>
			)}
		</div>
	);
});
