import {
	type ComposerPayload,
	serializeComposerPayload,
} from "./composerPayload";

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
	return {
		text: serializeComposerPayload(safePayload),
		payload: {
			mode: safePayload.mode,
			contextItems: safePayload.contextItems,
			attachments: safePayload.attachments,
			parts: safePayload.parts,
			metrics: safePayload.metrics,
		},
	};
}
