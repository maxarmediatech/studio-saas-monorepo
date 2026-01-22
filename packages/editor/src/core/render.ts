import Link from "@tiptap/extension-link";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";

import { extractText } from "./extract";
import type { EditorContentJson } from "./types";

const CORE_RENDER_EXTENSIONS = [
	StarterKit.configure({
		link: false,
	}),
	Link.configure({
		openOnClick: false,
		linkOnPaste: true,
	}),
	TaskList,
	TaskItem.configure({ nested: true }),
];

export function renderJsonToText(content: EditorContentJson): string {
	return extractText(content);
}

export function renderJsonToHtml(content: EditorContentJson): string {
	return generateHTML(content as any, CORE_RENDER_EXTENSIONS);
}
