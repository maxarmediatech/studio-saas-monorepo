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
	const kind = imageAttachmentKind(file.name || path || "");
	const allowPathless = input?.allowPathless ?? false;
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
