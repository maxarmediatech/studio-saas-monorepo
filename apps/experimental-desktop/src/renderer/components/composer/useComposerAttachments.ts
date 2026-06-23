import { useEffect, useState } from "react";
import { createComposerAttachment } from "./composerAttachments";
import type { ComposerAttachment } from "./composerTypes";

export function useComposerAttachments(input: {
	initialAttachments: ComposerAttachment[];
	resetSignal: number;
	onAttachmentsChange: (attachments: ComposerAttachment[]) => void;
}) {
	const [attachments, setAttachments] = useState<ComposerAttachment[]>(
		input.initialAttachments,
	);

	useEffect(() => {
		setAttachments(input.initialAttachments);
	}, [input.initialAttachments, input.resetSignal]);

	useEffect(() => {
		input.onAttachmentsChange(attachments);
	}, [attachments, input.onAttachmentsChange]);

	function addAttachment(attachment: ComposerAttachment) {
		setAttachments((items) =>
			items.some((existing) => existing.path === attachment.path)
				? items
				: [...items, attachment],
		);
	}

	function addAttachmentPath(path: string) {
		addAttachment(createComposerAttachment(path));
	}

	function addAttachmentPaths(paths: string[]) {
		setAttachments((items) => {
			const existingPaths = new Set(items.map((item) => item.path));
			const next = [...items];
			for (const path of paths) {
				if (existingPaths.has(path)) {
					continue;
				}
				existingPaths.add(path);
				next.push(createComposerAttachment(path));
			}
			return next;
		});
	}

	function removeAttachment(id: string) {
		setAttachments((items) => items.filter((item) => item.id !== id));
	}

	function clearAttachments() {
		setAttachments([]);
	}

	return {
		attachments,
		addAttachment,
		addAttachmentPath,
		addAttachmentPaths,
		removeAttachment,
		clearAttachments,
		setAttachments,
	};
}
