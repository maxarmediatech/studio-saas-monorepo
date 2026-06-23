import type { ComposerAttachment } from "./composerTypes";

export function createComposerAttachment(path: string): ComposerAttachment {
	return {
		id: globalThis.crypto.randomUUID(),
		kind: imageAttachmentKind(path),
		name: basenameFromPath(path),
		path,
		status: "ready",
	};
}

export function createComposerAttachmentFromFile(
	file: File & { path?: string },
	input?: { allowPathless?: boolean },
): ComposerAttachment {
	const path = file.path;
	const allowPathless = input?.allowPathless ?? false;
	const kind =
		allowPathless && !path
			? "image"
			: imageAttachmentKind(file.type || file.name || path || "");
	const pathlessReady = allowPathless && kind === "image";
	return {
		id: globalThis.crypto.randomUUID(),
		kind,
		name: file.name || (path ? basenameFromPath(path) : "Attachment"),
		path,
		mimeType: file.type || undefined,
		size: Number.isFinite(file.size) ? file.size : undefined,
		previewUrl: pathlessReady ? URL.createObjectURL(file) : undefined,
		status: path || pathlessReady ? "ready" : "failed",
		error:
			path || pathlessReady
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
	const kind = imageAttachmentKind(
		input.mimeType || input.name || input.path,
	);
	return {
		id: globalThis.crypto.randomUUID(),
		kind,
		name: input.name,
		path: input.path,
		mimeType: input.mimeType,
		size: input.size,
		previewUrl:
			kind === "image" && input.previewFile
				? URL.createObjectURL(input.previewFile)
				: undefined,
		status: "ready",
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

function imageAttachmentKind(path: string): ComposerAttachment["kind"] {
	return /^image\//i.test(path) || /\.(avif|gif|jpe?g|png|webp)$/i.test(path)
		? "image"
		: "file";
}
