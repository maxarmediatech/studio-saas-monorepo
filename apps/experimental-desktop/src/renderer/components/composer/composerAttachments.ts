import {
	inferAttachmentMimeType,
	isImageAttachmentMimeType,
} from "../../../shared/composerAttachmentPolicy";
import type { ComposerAttachment } from "./composerTypes";

export function createComposerAttachment(input: {
	path: string;
	name?: string;
	mimeType?: string;
	size?: number;
}): ComposerAttachment {
	const mimeType = inferAttachmentMimeType(input);
	return {
		id: globalThis.crypto.randomUUID(),
		kind: isImageAttachmentMimeType(mimeType) ? "image" : "file",
		name: input.name || basenameFromPath(input.path),
		path: input.path,
		mimeType,
		size: input.size,
		status: "ready",
	};
}

export function createComposerAttachmentFromFile(
	file: File & { path?: string },
): ComposerAttachment {
	const path = file.path;
	const mimeType = inferAttachmentMimeType({
		name: file.name,
		path,
		mimeType: file.type,
	});
	return {
		id: globalThis.crypto.randomUUID(),
		kind: isImageAttachmentMimeType(mimeType) ? "image" : "file",
		name: file.name || (path ? basenameFromPath(path) : "Attachment"),
		path,
		mimeType,
		size: Number.isFinite(file.size) ? file.size : undefined,
		status: path ? "ready" : "failed",
		error: path
			? undefined
			: "Could not read this file path from Electron.",
	};
}

export function createComposerAttachmentFromWrittenFile(input: {
	path: string;
	name: string;
	mimeType?: string;
	size?: number;
	previewFile?: File;
}): ComposerAttachment {
	const mimeType = inferAttachmentMimeType(input);
	const kind = isImageAttachmentMimeType(mimeType) ? "image" : "file";
	return {
		id: globalThis.crypto.randomUUID(),
		kind,
		name: input.name,
		path: input.path,
		mimeType,
		size: input.size,
		previewUrl:
			kind === "image" && input.previewFile
				? URL.createObjectURL(input.previewFile)
				: undefined,
		status: "ready",
	};
}

export function createFailedComposerAttachment(input: {
	name: string;
	mimeType?: string;
	size?: number;
	error: string;
}): ComposerAttachment {
	const mimeType = inferAttachmentMimeType(input);
	return {
		id: globalThis.crypto.randomUUID(),
		kind: isImageAttachmentMimeType(mimeType) ? "image" : "file",
		name: input.name,
		mimeType,
		size: input.size,
		status: "failed",
		error: input.error,
	};
}

export function basenameFromPath(path: string) {
	return path.slice(
		Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
	);
}

export function revokeComposerAttachmentPreview(
	attachment: ComposerAttachment,
) {
	if (attachment.previewUrl) {
		URL.revokeObjectURL(attachment.previewUrl);
	}
}
