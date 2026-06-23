import { useEffect, useRef, useState } from "react";
import {
	createComposerAttachment,
	createComposerAttachmentFromFile,
	createComposerAttachmentFromWrittenFile,
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

	async function addAttachmentFiles(
		files: File[],
		input?: { allowPathless?: boolean; defaultMimeType?: string },
	) {
		const nextAttachments = await Promise.all(
			files.map((file) =>
				createAttachmentFromFile(
					file as File & { path?: string },
					input,
				),
			),
		);
		setAttachments((items) => {
			const next = [...items];
			for (const attachment of nextAttachments) {
				if (next.some((item) => sameAttachment(item, attachment))) {
					revokeComposerAttachmentPreview(attachment);
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

async function createAttachmentFromFile(
	file: File & { path?: string },
	input?: { allowPathless?: boolean; defaultMimeType?: string },
) {
	if (file.path || !input?.allowPathless) {
		return createComposerAttachmentFromFile(file, input);
	}
	try {
		const mimeType =
			file.type || input?.defaultMimeType || "application/octet-stream";
		const written = await window.experimentalDesktop.writeAttachmentFile({
			name: file.name || fallbackAttachmentName(mimeType),
			mimeType,
			data: await file.arrayBuffer(),
		});
		return createComposerAttachmentFromWrittenFile({
			...written,
			previewFile: file,
		});
	} catch (error) {
		return {
			...createComposerAttachmentFromFile(file),
			status: "failed" as const,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function fallbackAttachmentName(mimeType: string) {
	switch (mimeType) {
		case "image/png":
			return "clipboard.png";
		case "image/jpeg":
			return "clipboard.jpg";
		case "image/gif":
			return "clipboard.gif";
		case "image/webp":
			return "clipboard.webp";
		default:
			return "attachment.bin";
	}
}

function sameAttachment(a: ComposerAttachment, b: ComposerAttachment) {
	if (a.path && b.path) {
		return a.path === b.path;
	}
	return a.name === b.name && a.size === b.size && a.mimeType === b.mimeType;
}
