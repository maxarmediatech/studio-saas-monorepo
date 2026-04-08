import type { UploadContext } from "@shared/lib/upload-policy";

export const WHATSAPP_MEDIA_UPLOAD_CONTEXT: UploadContext = "whatsapp-media";

export type WhatsAppComposerMediaType =
	| "image"
	| "video"
	| "audio"
	| "document";

export function getWhatsAppComposerMediaType(
	file: Pick<File, "type">,
): WhatsAppComposerMediaType | null {
	if (file.type.startsWith("image/")) {
		return "image";
	}

	if (file.type.startsWith("video/")) {
		return "video";
	}

	if (file.type.startsWith("audio/")) {
		return "audio";
	}

	if (
		file.type === "application/pdf" ||
		file.type === "application/msword" ||
		file.type ===
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		return "document";
	}

	return null;
}

export function supportsWhatsAppComposerCaption(
	mediaType: WhatsAppComposerMediaType,
) {
	return (
		mediaType === "image" ||
		mediaType === "video" ||
		mediaType === "document"
	);
}
