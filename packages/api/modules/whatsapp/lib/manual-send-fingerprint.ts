import { createHash } from "node:crypto";

export type ManualWhatsAppSendPayload =
	| {
			kind: "text";
			accountId: string;
			to: string;
			text: string;
			contactName?: string;
	  }
	| {
			kind: "template";
			accountId: string;
			to: string;
			templateName: string;
			language: string;
			components?: Array<Record<string, unknown>>;
	  }
	| {
			kind: "media";
			accountId: string;
			to: string;
			mediaType: "image" | "video" | "audio" | "document" | "sticker";
			mediaUrl?: string;
			mediaKey?: string;
			mimeType: string;
			caption?: string;
			fileName?: string;
	  };

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(canonicalize);
	}
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)]),
		);
	}
	return value;
}

export function canonicalManualSendJson(value: unknown): string {
	return JSON.stringify(canonicalize(value));
}

export function manualWhatsAppSendFingerprint(
	payload: ManualWhatsAppSendPayload,
): string {
	const semanticPayload =
		payload.kind === "text"
			? {
					accountId: payload.accountId,
					contactName: payload.contactName ?? null,
					kind: payload.kind,
					text: payload.text,
					to: payload.to,
				}
			: payload.kind === "template"
				? {
						accountId: payload.accountId,
						components: payload.components ?? [],
						kind: payload.kind,
						language: payload.language,
						templateName: payload.templateName,
						to: payload.to,
					}
				: {
						accountId: payload.accountId,
						caption: payload.caption ?? null,
						fileName: payload.fileName ?? null,
						kind: payload.kind,
						mediaKey: payload.mediaKey ?? null,
						mediaType: payload.mediaType,
						mediaUrl: payload.mediaUrl ?? null,
						mimeType: payload.mimeType,
						to: payload.to,
					};

	return createHash("sha256")
		.update(canonicalManualSendJson(semanticPayload))
		.digest("hex");
}
