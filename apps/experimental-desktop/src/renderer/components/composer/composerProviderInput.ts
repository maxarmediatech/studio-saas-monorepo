import {
	type ComposerPayload,
	serializeComposerPayload,
} from "./composerPayload";

export type ComposerNativeInputPart =
	| { type: "text"; text: string }
	| {
			type: "local_image";
			path: string;
			name: string;
			mimeType: string;
	  }
	| {
			type: "local_file";
			path: string;
			name: string;
			mimeType: string;
	  };

export function buildComposerProviderInput(payload: ComposerPayload) {
	const readyAttachments = payload.attachments.filter(
		(attachment) => attachment.status !== "failed" && attachment.path,
	);
	const readyAttachmentIds = new Set(
		readyAttachments.map((attachment) => attachment.id),
	);
	const parts = payload.parts.filter((part) => {
		if (
			part.type !== "attachment_file" &&
			part.type !== "attachment_image"
		) {
			return true;
		}
		return readyAttachmentIds.has(part.id);
	});
	const safePayload = {
		...payload,
		attachments: readyAttachments,
		parts,
	};
	const text = serializeComposerPayload(safePayload, {
		omitNativeAttachments: readyAttachments.length > 0,
	});
	return {
		text,
		nativeInput: [
			{ type: "text" as const, text },
			...readyAttachments
				.filter(
					(attachment) =>
						attachment.kind === "image" &&
						attachment.path &&
						attachment.mimeType,
				)
				.map((attachment) => ({
					type: "local_image" as const,
					path: attachment.path as string,
					name: attachment.name,
					mimeType: attachment.mimeType as string,
				})),
			...readyAttachments
				.filter(
					(attachment) =>
						attachment.kind !== "image" &&
						attachment.path &&
						attachment.mimeType,
				)
				.map((attachment) => ({
					type: "local_file" as const,
					path: attachment.path as string,
					name: attachment.name,
					mimeType: attachment.mimeType as string,
				})),
		] satisfies ComposerNativeInputPart[],
		payload: {
			mode: safePayload.mode,
			contextItems: safePayload.contextItems,
			attachments: safePayload.attachments,
			parts: safePayload.parts,
			metrics: safePayload.metrics,
			nativeInput: {
				kind: "codex-app-server-v1",
				imageCount: readyAttachments.filter(
					(attachment) => attachment.kind === "image",
				).length,
				fileCount: readyAttachments.filter(
					(attachment) => attachment.kind !== "image",
				).length,
			},
		},
	};
}
