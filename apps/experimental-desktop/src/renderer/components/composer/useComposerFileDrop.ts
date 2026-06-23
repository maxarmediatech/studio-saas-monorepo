import { type ClipboardEvent, type DragEvent, useState } from "react";

export function useComposerFileDrop(input: {
	onFiles: (
		files: File[],
		input?: { allowPathless?: boolean; defaultMimeType?: string },
	) => void;
}) {
	const [dragActive, setDragActive] = useState(false);

	function onDragEnter(event: DragEvent<HTMLElement>) {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		setDragActive(true);
	}

	function onDragOver(event: DragEvent<HTMLElement>) {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setDragActive(true);
	}

	function onDragLeave(event: DragEvent<HTMLElement>) {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
			setDragActive(false);
		}
	}

	function onDrop(event: DragEvent<HTMLElement>) {
		if (!hasDraggedFiles(event)) {
			return;
		}
		event.preventDefault();
		setDragActive(false);
		input.onFiles(Array.from(event.dataTransfer.files), {
			allowPathless: true,
		});
	}

	function onPaste(event: ClipboardEvent<HTMLElement>) {
		const files = readClipboardFiles(event);
		if (files.length === 0) {
			return;
		}
		event.preventDefault();
		input.onFiles(files, {
			allowPathless: true,
			defaultMimeType: "image/png",
		});
	}

	return {
		dragActive,
		onDragEnter,
		onDragOver,
		onDragLeave,
		onDrop,
		onPaste,
	};
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
	return Array.from(event.dataTransfer.types).includes("Files");
}

function readClipboardFiles(event: ClipboardEvent<HTMLElement>) {
	const directFiles = Array.from(event.clipboardData.files);
	if (directFiles.length > 0) {
		return directFiles;
	}
	return Array.from(event.clipboardData.items)
		.filter((item) => item.kind === "file")
		.map((item) => item.getAsFile())
		.filter((file): file is File => Boolean(file));
}
