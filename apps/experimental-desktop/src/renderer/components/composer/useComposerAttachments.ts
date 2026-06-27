import type { SetStateAction } from "react";
import { useEffect, useRef, useState } from "react";
import {
	formatAttachmentLimitBytes,
	isSupportedAttachmentMimeType,
	MAX_ATTACHMENT_SIZE_BYTES,
	MAX_COMPOSER_ATTACHMENTS,
	MAX_TOTAL_ATTACHMENT_BYTES,
} from "../../../shared/composerAttachmentPolicy";
import {
	basenameFromPath,
	createComposerAttachment,
	createComposerAttachmentFromFile,
	createComposerAttachmentFromWrittenFile,
	createFailedComposerAttachment,
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
	const [attachmentNotice, setAttachmentNotice] = useState<string>();
	const attachmentsRef = useRef(attachments);
	const reportedAttachmentsRef = useRef(attachments);
	const lastResetSignalRef = useRef(input.resetSignal);

	useEffect(() => {
		attachmentsRef.current = attachments;
	}, [attachments]);

	useEffect(() => {
		if (lastResetSignalRef.current === input.resetSignal) {
			return;
		}
		lastResetSignalRef.current = input.resetSignal;
		commitAttachments(input.initialAttachments, {
			revokeRemoved: true,
			notice: undefined,
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
		if (sameAttachmentList(reportedAttachmentsRef.current, attachments)) {
			return;
		}
		reportedAttachmentsRef.current = attachments;
		input.onAttachmentsChange(attachments);
	}, [attachments, input.onAttachmentsChange]);

	function addAttachment(attachment: ComposerAttachment) {
		const result = appendAttachments(attachmentsRef.current, [attachment]);
		setAttachmentNotice(result.notice);
		commitAttachments(result.attachments);
	}

	async function addAttachmentPath(path: string) {
		addAttachment(await createAttachmentFromPath(path));
	}

	async function addAttachmentPaths(paths: string[]) {
		const attachments = await Promise.all(
			paths.map(createAttachmentFromPath),
		);
		const result = appendAttachments(attachmentsRef.current, attachments);
		setAttachmentNotice(result.notice);
		commitAttachments(result.attachments);
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
		const result = appendAttachments(
			attachmentsRef.current,
			nextAttachments,
		);
		setAttachmentNotice(result.notice);
		commitAttachments(result.attachments);
	}

	function removeAttachment(id: string) {
		for (const item of attachmentsRef.current) {
			if (item.id === id) {
				revokeComposerAttachmentPreview(item);
			}
		}
		setAttachmentNotice(undefined);
		commitAttachments(
			attachmentsRef.current.filter((item) => item.id !== id),
		);
	}

	function clearAttachments() {
		for (const item of attachmentsRef.current) {
			revokeComposerAttachmentPreview(item);
		}
		setAttachmentNotice(undefined);
		commitAttachments([]);
	}

	function commitAttachments(
		nextValue: SetStateAction<ComposerAttachment[]>,
		options?: {
			revokeRemoved?: boolean;
			notice?: string;
		},
	) {
		setAttachments((items) => {
			const next =
				typeof nextValue === "function" ? nextValue(items) : nextValue;
			if (options?.revokeRemoved) {
				for (const item of items) {
					if (!next.some((nextItem) => nextItem.id === item.id)) {
						revokeComposerAttachmentPreview(item);
					}
				}
			}
			if (sameAttachmentList(items, next)) {
				return items;
			}
			attachmentsRef.current = next;
			return next;
		});
		if ("notice" in (options ?? {})) {
			setAttachmentNotice(options?.notice);
		}
	}

	return {
		attachments,
		addAttachment,
		addAttachmentPath,
		addAttachmentPaths,
		addAttachmentFiles,
		removeAttachment,
		clearAttachments,
		setAttachments: commitAttachments,
		attachmentIssue: composerAttachmentIssue(attachments),
		attachmentNotice,
	};
}

function sameAttachmentList(a: ComposerAttachment[], b: ComposerAttachment[]) {
	return (
		a.length === b.length &&
		a.every((attachment, index) => {
			const next = b[index];
			return (
				next &&
				attachment.id === next.id &&
				attachment.kind === next.kind &&
				attachment.name === next.name &&
				attachment.path === next.path &&
				attachment.mimeType === next.mimeType &&
				attachment.size === next.size &&
				attachment.status === next.status &&
				attachment.error === next.error &&
				attachment.previewUrl === next.previewUrl
			);
		})
	);
}

async function createAttachmentFromPath(path: string) {
	try {
		const info =
			await window.experimentalDesktop.getAttachmentFileInfo(path);
		return createComposerAttachment(info);
	} catch (error) {
		return createFailedComposerAttachment({
			name: basenameFromPath(path),
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

async function createAttachmentFromFile(
	file: File & { path?: string },
	input?: { allowPathless?: boolean; defaultMimeType?: string },
) {
	const nativePath = getNativeFilePath(file);
	if (nativePath) {
		return createAttachmentFromPath(nativePath);
	}
	if (!input?.allowPathless) {
		return createComposerAttachmentFromFile(file);
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

function getNativeFilePath(file: File & { path?: string }) {
	if (file.path) {
		return file.path;
	}
	try {
		return window.experimentalDesktop.getPathForFile(file);
	} catch {
		return "";
	}
}

function appendAttachments(
	items: ComposerAttachment[],
	attachments: ComposerAttachment[],
) {
	const next = [...items];
	let skippedCount = 0;
	let firstSkipReason: string | undefined;
	for (const attachment of attachments) {
		if (next.some((item) => sameAttachment(item, attachment))) {
			revokeComposerAttachmentPreview(attachment);
			continue;
		}
		const error = newAttachmentIssue(next, attachment);
		if (error) {
			skippedCount += 1;
			firstSkipReason ??= error;
			revokeComposerAttachmentPreview(attachment);
			continue;
		}
		next.push(attachment);
	}
	return {
		attachments: next,
		notice:
			skippedCount > 0
				? skippedAttachmentNotice(skippedCount, firstSkipReason)
				: undefined,
	};
}

function skippedAttachmentNotice(count: number, reason: string | undefined) {
	const files = count === 1 ? "file" : "files";
	return `Skipped ${count} ${files}${reason ? `: ${reason}` : "."}`;
}

function newAttachmentIssue(
	existing: ComposerAttachment[],
	attachment: ComposerAttachment,
) {
	if (attachment.status === "failed") {
		return undefined;
	}
	if (!attachment.path) {
		return "Attachment needs a readable local file path.";
	}
	if (!isSupportedAttachmentMimeType(attachment.mimeType)) {
		return "Unsupported attachment type.";
	}
	if (
		typeof attachment.size === "number" &&
		attachment.size > MAX_ATTACHMENT_SIZE_BYTES
	) {
		return `Attachment is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}.`;
	}
	const readyAttachments = existing.filter(
		(item) => item.status !== "failed",
	);
	if (readyAttachments.length >= MAX_COMPOSER_ATTACHMENTS) {
		return `You can attach up to ${MAX_COMPOSER_ATTACHMENTS} files per message.`;
	}
	const nextTotal =
		readyAttachments.reduce((total, item) => total + (item.size ?? 0), 0) +
		(attachment.size ?? 0);
	if (nextTotal > MAX_TOTAL_ATTACHMENT_BYTES) {
		return `Attachments are larger than ${formatAttachmentLimitBytes(MAX_TOTAL_ATTACHMENT_BYTES)} total.`;
	}
	return undefined;
}

export function composerAttachmentIssue(attachments: ComposerAttachment[]) {
	if (attachments.some((attachment) => attachment.status === "failed")) {
		return "Remove failed attachments before sending.";
	}
	if (attachments.some((attachment) => !attachment.path)) {
		return "Every attachment needs a readable local file path.";
	}
	if (
		attachments.some(
			(attachment) => !isSupportedAttachmentMimeType(attachment.mimeType),
		)
	) {
		return "One or more attachments use an unsupported file type.";
	}
	const totalSize = attachments.reduce(
		(total, attachment) => total + (attachment.size ?? 0),
		0,
	);
	if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
		return `Attachments are larger than ${formatAttachmentLimitBytes(MAX_TOTAL_ATTACHMENT_BYTES)} total.`;
	}
	if (attachments.length > MAX_COMPOSER_ATTACHMENTS) {
		return `You can attach up to ${MAX_COMPOSER_ATTACHMENTS} files per message.`;
	}
	return undefined;
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
