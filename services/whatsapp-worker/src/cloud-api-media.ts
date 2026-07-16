import { getUploadsBucketName } from "@repo/env";
import { putObject } from "@repo/storage";
import type { MessageType } from "@repo/whatsapp-core";

type GraphMediaMetadata = {
	url?: string;
	mime_type?: string;
	file_size?: number | string;
};

const MIME_EXTENSION_MAP: Record<string, string> = {
	"application/pdf": "pdf",
	"audio/aac": "aac",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"audio/ogg": "ogg",
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"text/plain": "txt",
	"video/mp4": "mp4",
	"video/quicktime": "mov",
};

const FALLBACK_FILE_NAME_BY_TYPE: Partial<Record<MessageType, string>> = {
	audio: "audio",
	document: "document",
	image: "image",
	sticker: "sticker",
	video: "video",
};

const parseFileSize = (value: GraphMediaMetadata["file_size"]) => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const sanitizeFileName = (value: string) =>
	value
		.trim()
		.replace(/[/\\?%*:|"<>]/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-") || "attachment";

const resolveFileName = (params: {
	fileName?: string | null;
	messageType: MessageType;
	mediaId: string;
	mimeType: string;
}) => {
	if (params.fileName?.trim()) {
		return sanitizeFileName(params.fileName);
	}
	const base = FALLBACK_FILE_NAME_BY_TYPE[params.messageType] ?? "attachment";
	const extension = MIME_EXTENSION_MAP[params.mimeType.toLowerCase()];
	return sanitizeFileName(
		extension
			? `${base}-${params.mediaId}.${extension}`
			: `${base}-${params.mediaId}`,
	);
};

const fetchJson = async <T>(
	url: string,
	accessToken: string,
	message: string,
) => {
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});
	if (!response.ok) {
		throw new Error(message);
	}
	const payload = (await response.json().catch(() => null)) as T | null;
	if (!payload) {
		throw new Error(message);
	}
	return payload;
};

export const ingestCloudApiMediaAsset = async (params: {
	accessToken: string;
	accountId: string;
	organizationId: string;
	mediaId: string;
	messageType: MessageType;
	apiVersion: string;
	fileName?: string | null;
	mimeType?: string | null;
}) => {
	const metadata = await fetchJson<GraphMediaMetadata>(
		`https://graph.facebook.com/${params.apiVersion}/${params.mediaId}`,
		params.accessToken,
		`Failed to fetch WhatsApp media metadata for ${params.mediaId}`,
	);
	if (!metadata.url) {
		throw new Error(
			`WhatsApp media ${params.mediaId} did not include a URL`,
		);
	}

	const response = await fetch(metadata.url, {
		headers: { Authorization: `Bearer ${params.accessToken}` },
	});
	if (!response.ok) {
		throw new Error(`Failed to download WhatsApp media ${params.mediaId}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	const mimeType =
		response.headers.get("content-type") ??
		metadata.mime_type ??
		params.mimeType;
	if (!mimeType) {
		throw new Error(
			`WhatsApp media ${params.mediaId} is missing a mime type`,
		);
	}
	const fileName = resolveFileName({
		fileName: params.fileName,
		messageType: params.messageType,
		mediaId: params.mediaId,
		mimeType,
	});
	const storageKey = `orgs/${params.organizationId}/whatsapp/inbound/${params.accountId}/${params.mediaId}-${fileName}`;
	const headerSize = response.headers.get("content-length");
	const fileSize = headerSize
		? Number.parseInt(headerSize, 10)
		: parseFileSize(metadata.file_size);

	await putObject(storageKey, {
		bucket: getUploadsBucketName(),
		body: bytes,
		contentType: mimeType,
		contentLength: fileSize ?? undefined,
	});

	return { fileName, fileSize, mimeType, storageUrl: storageKey };
};
