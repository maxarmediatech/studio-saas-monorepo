import { useEffect, useRef, useState } from "react";
import {
	createComposerAttachment,
	createComposerAttachmentFromFile,
	revokeComposerAttachmentPreview,
} from "./composerAttachments";
import type { ComposerAttachment } from "./composerTypes";

export function useComposerAttachments(input: {
	initialAttachments: ComposerAttachment[];
	resetSignal: number;
	onAttachmentsChange: (attachments: ComposerAttachment[]) => void;
}) {
	const [attachments, setAttachments] = useState<ComposerAttachment[]>(
		input.initialAttachments,
	);
	const attachmentsRef = useRef(attachments);

	useEffect(() => {
		attachmentsRef.current = attachments;
	}, [attachments]);

	useEffect(() => {
		setAttachments((items) => {
			for (const item of items) {
				if (
					!input.initialAttachments.some(
						(next) => next.id === item.id,
					)
				) {
					revokeComposerAttachmentPreview(item);
				}
			}
			return input.initialAttachments;
		});
	}, [input.initialAttachments, input.resetSignal]);

	useEffect(() => {
		return () => {
			for (const attachment of attachmentsRef.current) {
				revokeComposerAttachmentPreview(attachment);
			}
		};
	}, []);

	useEffect(() => {
		input.onAttachmentsChange(attachments);
	}, [attachments, input.onAttachmentsChange]);

	function addAttachment(attachment: ComposerAttachment) {
		setAttachments((items) =>
			items.some((existing) => sameAttachment(existing, attachment))
				? items
				: [...items, attachment],
		);
	}

	function addAttachmentPath(path: string) {
		addAttachment(createComposerAttachment(path));
	}

	function addAttachmentPaths(paths: string[]) {
		setAttachments((items) => {
			const next = [...items];
			for (const path of paths) {
				const attachment = createComposerAttachment(path);
				if (next.some((item) => sameAttachment(item, attachment))) {
					continue;
				}
				next.push(attachment);
			}
			return next;
		});
	}

	function addAttachmentFiles(
		files: File[],
		input?: { allowPathless?: boolean },
	) {
		setAttachments((items) => {
			const next = [...items];
			for (const file of files) {
				const attachment = createComposerAttachmentFromFile(
					file as File & { path?: string },
					input,
				);
				if (next.some((item) => sameAttachment(item, attachment))) {
					continue;
				}
				next.push(attachment);
			}
			return next;
		});
	}

	function removeAttachment(id: string) {
		setAttachments((items) => {
			for (const item of items) {
				if (item.id === id) {
					revokeComposerAttachmentPreview(item);
				}
			}
			return items.filter((item) => item.id !== id);
		});
	}

	function clearAttachments() {
		setAttachments((items) => {
			for (const item of items) {
				revokeComposerAttachmentPreview(item);
			}
			return [];
		});
	}

	return {
		attachments,
		addAttachment,
		addAttachmentPath,
		addAttachmentPaths,
		addAttachmentFiles,
		removeAttachment,
		clearAttachments,
		setAttachments,
	};
}

function sameAttachment(a: ComposerAttachment, b: ComposerAttachment) {
	if (a.path && b.path) {
		return a.path === b.path;
	}
	return a.name === b.name && a.size === b.size && a.mimeType === b.mimeType;
}
