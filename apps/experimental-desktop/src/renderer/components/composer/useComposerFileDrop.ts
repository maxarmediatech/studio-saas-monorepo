import { type DragEvent, useState } from "react";

export function useComposerFileDrop(input: {
	onDropPaths: (paths: string[]) => void;
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
		input.onDropPaths(readDroppedFilePaths(event.dataTransfer.files));
	}

	return {
		dragActive,
		onDragEnter,
		onDragOver,
		onDragLeave,
		onDrop,
	};
}

function hasDraggedFiles(event: DragEvent<HTMLElement>) {
	return Array.from(event.dataTransfer.types).includes("Files");
}

function readDroppedFilePaths(files: FileList) {
	return Array.from(files)
		.map((file) => (file as File & { path?: string }).path)
		.filter((path): path is string => Boolean(path));
}
