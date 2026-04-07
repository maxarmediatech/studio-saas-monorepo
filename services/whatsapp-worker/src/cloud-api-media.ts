import { getUploadsBucketName } from "../../../packages/env";
import { putObject } from "../../../packages/storage";
import type { MessageType } from "../../../packages/whatsapp-core";

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
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return null;
};

const sanitizeFileName = (value: string) => {
	const sanitized = value
		.trim()
		.replace(/[/\\?%*:|"<>]/g, "-")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-");

	return sanitized || "attachment";
};

const getExtensionForMimeType = (mimeType: string | null) => {
	if (!mimeType) {
		return null;
	}

	return MIME_EXTENSION_MAP[mimeType.toLowerCase()] ?? null;
};

const resolveFileName = (params: {
	fileName?: string | null;
	messageType: MessageType;
	mediaId: string;
	mimeType: string | null;
}) => {
	const providedName = params.fileName?.trim();
	if (providedName) {
		return sanitizeFileName(providedName);
	}

	const baseName =
		FALLBACK_FILE_NAME_BY_TYPE[params.messageType] ?? "attachment";
	const extension = getExtensionForMimeType(params.mimeType);

	return sanitizeFileName(
		extension
			? `${baseName}-${params.mediaId}.${extension}`
			: `${baseName}-${params.mediaId}`,
	);
};

const buildStorageKey = (params: {
	organizationId: string;
	accountId: string;
	fileName: string;
	mediaId: string;
}) =>
	`orgs/${params.organizationId}/whatsapp/inbound/${params.accountId}/${Date.now()}-${params.mediaId}-${params.fileName}`;

const fetchGraphPayload = async <T>(
	url: string,
	accessToken: string,
	fallbackMessage: string,
) => {
	const response = await fetch(url, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(fallbackMessage);
	}

	const payload = (await response.json().catch(() => null)) as T | null;
	if (!payload) {
		throw new Error(fallbackMessage);
	}

	return payload;
};

const fetchMediaMetadata = async (params: {
	accessToken: string;
	apiVersion: string;
	mediaId: string;
}) =>
	fetchGraphPayload<GraphMediaMetadata>(
		`https://graph.facebook.com/${params.apiVersion}/${params.mediaId}`,
		params.accessToken,
		`Failed to fetch WhatsApp media metadata for ${params.mediaId}`,
	);

const downloadMediaBytes = async (params: {
	accessToken: string;
	mediaId: string;
	url: string;
}) => {
	const response = await fetch(params.url, {
		headers: {
			Authorization: `Bearer ${params.accessToken}`,
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to download WhatsApp media ${params.mediaId}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	const contentType = response.headers.get("content-type");
	const contentLength = response.headers.get("content-length");

	return {
		bytes,
		contentType,
		contentLength: contentLength
			? Number.parseInt(contentLength, 10)
			: null,
	};
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
	const metadata = await fetchMediaMetadata({
		accessToken: params.accessToken,
		apiVersion: params.apiVersion,
		mediaId: params.mediaId,
	});

	if (!metadata.url) {
		throw new Error(
			`WhatsApp media ${params.mediaId} did not include a URL`,
		);
	}

	const download = await downloadMediaBytes({
		accessToken: params.accessToken,
		mediaId: params.mediaId,
		url: metadata.url,
	});

	const mimeType =
		download.contentType ?? metadata.mime_type ?? params.mimeType ?? null;
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
	const storageKey = buildStorageKey({
		organizationId: params.organizationId,
		accountId: params.accountId,
		fileName,
		mediaId: params.mediaId,
	});

	await putObject(storageKey, {
		bucket: getUploadsBucketName(),
		body: download.bytes,
		contentType: mimeType,
		contentLength:
			download.contentLength ??
			parseFileSize(metadata.file_size) ??
			undefined,
	});

	return {
		fileName,
		fileSize:
			download.contentLength ?? parseFileSize(metadata.file_size) ?? null,
		mimeType,
		providerMediaId: params.mediaId,
		storageType: "s3" as const,
		storageUrl: storageKey,
	};
};
