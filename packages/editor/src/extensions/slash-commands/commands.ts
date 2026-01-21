import type { Editor } from "@tiptap/core";
import {
	Code,
	Heading1,
	Heading2,
	Heading3,
	List,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	Minus,
	Quote,
} from "lucide-react";

export interface SlashCommand {
	key: string;
	title: string;
	description: string;
	icon: LucideIcon;
	action: (editor: Editor) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
	{
		key: "h1",
		title: "Heading 1",
		description: "Large section heading",
		icon: Heading1,
		action: (editor) =>
			editor.chain().focus().toggleHeading({ level: 1 }).run(),
	},
	{
		key: "h2",
		title: "Heading 2",
		description: "Medium section heading",
		icon: Heading2,
		action: (editor) =>
			editor.chain().focus().toggleHeading({ level: 2 }).run(),
	},
	{
		key: "h3",
		title: "Heading 3",
		description: "Small section heading",
		icon: Heading3,
		action: (editor) =>
			editor.chain().focus().toggleHeading({ level: 3 }).run(),
	},
	{
		key: "bullet",
		title: "Bullet List",
		description: "Create a simple bullet list",
		icon: List,
		action: (editor) => editor.chain().focus().toggleBulletList().run(),
	},
	{
		key: "numbered",
		title: "Numbered List",
		description: "Create a numbered list",
		icon: ListOrdered,
		action: (editor) => editor.chain().focus().toggleOrderedList().run(),
	},
	{
		key: "task",
		title: "Task List",
		description: "Create a task checklist",
		icon: ListTodo,
		action: (editor) => editor.chain().focus().toggleTaskList().run(),
	},
	{
		key: "quote",
		title: "Quote",
		description: "Add a blockquote",
		icon: Quote,
		action: (editor) => editor.chain().focus().toggleBlockquote().run(),
	},
	{
		key: "code",
		title: "Code Block",
		description: "Add a code block",
		icon: Code,
		action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
	},
	{
		key: "divider",
		title: "Divider",
		description: "Add a horizontal divider",
		icon: Minus,
		action: (editor) => editor.chain().focus().setHorizontalRule().run(),
	},
];

export function filterCommands(query: string): SlashCommand[] {
	const lowerQuery = query.toLowerCase();
	return SLASH_COMMANDS.filter(
		(cmd) =>
			cmd.title.toLowerCase().includes(lowerQuery) ||
			cmd.key.toLowerCase().includes(lowerQuery) ||
			cmd.description.toLowerCase().includes(lowerQuery),
	);
}
