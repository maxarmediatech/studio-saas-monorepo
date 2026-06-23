import type { ComposerAttachment } from "./composerTypes";

export function createComposerAttachment(path: string): ComposerAttachment {
	return {
		id: globalThis.crypto.randomUUID(),
		kind: imageAttachmentKind(path),
		name: basenameFromPath(path),
		path,
	};
}

export function basenameFromPath(path: string) {
	return path.slice(
		Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
	);
}

function imageAttachmentKind(path: string): ComposerAttachment["kind"] {
	return /\.(avif|gif|jpe?g|png|webp)$/i.test(path) ? "image" : "file";
}
