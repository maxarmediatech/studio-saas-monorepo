import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import type { Extensions } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

export interface ExtensionOptions {
	placeholder?: string;
	enableTaskList?: boolean;
	enableCodeBlock?: boolean;
	enableBlockquote?: boolean;
	enableHeadings?: boolean;
	enableHorizontalRule?: boolean;
}

export function createBaseExtensions(
	options: ExtensionOptions = {},
): Extensions {
	const {
		placeholder = "Write something...",
		enableTaskList = true,
		enableCodeBlock = true,
		enableBlockquote = true,
		enableHeadings = true,
		enableHorizontalRule = true,
	} = options;

	const extensions: Extensions = [
		StarterKit.configure({
			heading: enableHeadings ? { levels: [1, 2, 3] } : false,
			codeBlock: enableCodeBlock ? {} : false,
			blockquote: enableBlockquote ? {} : false,
			horizontalRule: enableHorizontalRule ? {} : false,
		}),
		Link.configure({
			openOnClick: false,
			autolink: true,
			defaultProtocol: "https",
			HTMLAttributes: {
				class: "text-primary underline underline-offset-2",
				rel: "noopener noreferrer",
				target: "_blank",
			},
			validate: (href) => /^https?:\/\//.test(href),
		}),
		Placeholder.configure({
			placeholder,
			emptyEditorClass: "is-editor-empty",
		}),
	];

	if (enableTaskList) {
		extensions.push(
			TaskList.configure({
				HTMLAttributes: {
					class: "editor-task-list",
				},
			}),
			TaskItem.configure({
				nested: true,
				HTMLAttributes: {
					class: "editor-task-item",
				},
			}),
		);
	}

	return extensions;
}

export function createLiteExtensions(placeholder?: string): Extensions {
	return createBaseExtensions({
		placeholder,
		enableTaskList: false,
		enableCodeBlock: false,
		enableBlockquote: false,
		enableHeadings: false,
		enableHorizontalRule: false,
	});
}

export function createFullExtensions(placeholder?: string): Extensions {
	return createBaseExtensions({
		placeholder,
		enableTaskList: true,
		enableCodeBlock: true,
		enableBlockquote: true,
		enableHeadings: true,
		enableHorizontalRule: true,
	});
}
