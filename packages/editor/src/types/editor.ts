import type { Editor } from "@tiptap/react";
import type { JSONContent } from "./content";
import type { MentionHandler } from "./mention";

export interface EditorRef {
	editor: Editor | null;
	focus: () => void;
	blur: () => void;
	isEmpty: () => boolean;
	getJSON: () => JSONContent | undefined;
	getText: () => string;
	getHTML: () => string;
	clear: () => void;
}

export interface BaseEditorProps {
	value?: JSONContent;
	placeholder?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	className?: string;
	onChange?: (json: JSONContent) => void;
	onFocus?: () => void;
	onBlur?: () => void;
}

export interface LiteEditorProps extends BaseEditorProps {
	onSubmit?: (json: JSONContent, text: string) => void;
	mentionHandler?: MentionHandler;
}

export interface FullEditorProps extends LiteEditorProps {
	enableSlashCommands?: boolean;
	enableBubbleMenu?: boolean;
}
