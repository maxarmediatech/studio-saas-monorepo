"use client";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type { Editor } from "@tiptap/react";
import { BoldIcon, ItalicIcon, ListTodoIcon } from "lucide-react";

interface StickyFormatToolbarProps {
	editor: Editor | null;
	className?: string;
}

const FORMAT_BUTTONS = [
	{
		key: "bold",
		icon: BoldIcon,
		label: "Bold",
		shortcut: "⌘B",
		action: (editor: Editor) => editor.chain().focus().toggleBold().run(),
		isActive: (editor: Editor) => editor.isActive("bold"),
	},
	{
		key: "italic",
		icon: ItalicIcon,
		label: "Italic",
		shortcut: "⌘I",
		action: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
		isActive: (editor: Editor) => editor.isActive("italic"),
	},
	{
		key: "taskList",
		icon: ListTodoIcon,
		label: "Todo list",
		shortcut: "⌘⇧9",
		action: (editor: Editor) =>
			editor.chain().focus().toggleTaskList().run(),
		isActive: (editor: Editor) => editor.isActive("taskList"),
	},
] as const;

export function StickyFormatToolbar({
	editor,
	className,
}: StickyFormatToolbarProps) {
	if (!editor) {
		return null;
	}

	return (
		<div className={cn("flex items-center gap-0.5", className)}>
			{FORMAT_BUTTONS.map(
				({ key, icon: Icon, label, shortcut, action, isActive }) => (
					<Tooltip key={key}>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={() => action(editor)}
								className={cn(
									"flex items-center justify-center rounded p-1.5 transition-colors",
									isActive(editor)
										? "bg-foreground/10 text-foreground/80"
										: "text-foreground/50 hover:text-foreground/70 hover:bg-foreground/5",
								)}
								aria-label={`${label} (${shortcut})`}
							>
								<Icon className="size-4" />
							</button>
						</TooltipTrigger>
						<TooltipContent side="top">
							<span className="text-xs font-medium">
								{label}{" "}
								<span className="text-muted-foreground">
									{shortcut}
								</span>
							</span>
						</TooltipContent>
					</Tooltip>
				),
			)}
		</div>
	);
}
