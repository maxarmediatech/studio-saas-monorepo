"use client";

import type { Editor } from "@tiptap/core";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react";
import { Bold, Code, Italic, Link, Strikethrough } from "lucide-react";
import { useCallback, useState } from "react";

interface BubbleMenuProps {
	editor: Editor;
}

export function BubbleMenu({ editor }: BubbleMenuProps) {
	const [showLinkInput, setShowLinkInput] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");

	const toggleBold = useCallback(() => {
		editor.chain().focus().toggleBold().run();
	}, [editor]);

	const toggleItalic = useCallback(() => {
		editor.chain().focus().toggleItalic().run();
	}, [editor]);

	const toggleStrike = useCallback(() => {
		editor.chain().focus().toggleStrike().run();
	}, [editor]);

	const toggleCode = useCallback(() => {
		editor.chain().focus().toggleCode().run();
	}, [editor]);

	const setLink = useCallback(() => {
		if (linkUrl) {
			const url = linkUrl.startsWith("http")
				? linkUrl
				: `https://${linkUrl}`;
			editor.chain().focus().setLink({ href: url }).run();
		}
		setShowLinkInput(false);
		setLinkUrl("");
	}, [editor, linkUrl]);

	const removeLink = useCallback(() => {
		editor.chain().focus().unsetLink().run();
	}, [editor]);

	const openLinkInput = useCallback(() => {
		const existingUrl = editor.getAttributes("link").href;
		setLinkUrl(existingUrl || "");
		setShowLinkInput(true);
	}, [editor]);

	const isActive = (name: string) => editor.isActive(name);

	if (showLinkInput) {
		return (
			<TiptapBubbleMenu
				editor={editor}
				tippyOptions={{ duration: 100, placement: "top" }}
				className="bubble-menu bg-popover border border-border rounded-md shadow-md p-1 flex items-center gap-1"
			>
				<input
					type="url"
					placeholder="Enter URL..."
					value={linkUrl}
					onChange={(e) => setLinkUrl(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							setLink();
						}
						if (e.key === "Escape") {
							setShowLinkInput(false);
							setLinkUrl("");
						}
					}}
					className="h-7 px-2 text-sm bg-transparent border-none outline-none min-w-[200px]"
					// biome-ignore lint/a11y/noAutofocus: intentional focus for UX
					autoFocus
				/>
				<button
					type="button"
					onClick={setLink}
					className="h-7 px-2 text-sm font-medium text-primary hover:bg-accent rounded"
				>
					Save
				</button>
				{editor.isActive("link") && (
					<button
						type="button"
						onClick={removeLink}
						className="h-7 px-2 text-sm text-destructive hover:bg-accent rounded"
					>
						Remove
					</button>
				)}
			</TiptapBubbleMenu>
		);
	}

	return (
		<TiptapBubbleMenu
			editor={editor}
			tippyOptions={{ duration: 100, placement: "top" }}
			className="bubble-menu bg-popover border border-border rounded-md shadow-md p-1 flex items-center gap-0.5"
		>
			<BubbleButton
				onClick={toggleBold}
				isActive={isActive("bold")}
				title="Bold"
			>
				<Bold className="w-4 h-4" />
			</BubbleButton>

			<BubbleButton
				onClick={toggleItalic}
				isActive={isActive("italic")}
				title="Italic"
			>
				<Italic className="w-4 h-4" />
			</BubbleButton>

			<BubbleButton
				onClick={toggleStrike}
				isActive={isActive("strike")}
				title="Strikethrough"
			>
				<Strikethrough className="w-4 h-4" />
			</BubbleButton>

			<BubbleButton
				onClick={toggleCode}
				isActive={isActive("code")}
				title="Code"
			>
				<Code className="w-4 h-4" />
			</BubbleButton>

			<div className="w-px h-4 bg-border mx-1" />

			<BubbleButton
				onClick={openLinkInput}
				isActive={isActive("link")}
				title="Link"
			>
				<Link className="w-4 h-4" />
			</BubbleButton>
		</TiptapBubbleMenu>
	);
}

interface BubbleButtonProps {
	onClick: () => void;
	isActive: boolean;
	title: string;
	children: React.ReactNode;
}

function BubbleButton({
	onClick,
	isActive,
	title,
	children,
}: BubbleButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`w-7 h-7 flex items-center justify-center rounded hover:bg-accent transition-colors ${
				isActive
					? "bg-accent text-accent-foreground"
					: "text-muted-foreground"
			}`}
		>
			{children}
		</button>
	);
}
