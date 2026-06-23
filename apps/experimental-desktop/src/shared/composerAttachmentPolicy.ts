export const MAX_COMPOSER_ATTACHMENTS = 8;
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_ATTACHMENT_MIME_TYPES = new Set([
	"application/json",
	"application/pdf",
	"application/toml",
	"application/x-yaml",
	"application/xml",
	"image/avif",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/webp",
	"text/css",
	"text/csv",
	"text/html",
	"text/javascript",
	"text/markdown",
	"text/plain",
	"text/xml",
]);

const EXTENSION_MIME_TYPES: Record<string, string> = {
	".avif": "image/avif",
	".css": "text/css",
	".csv": "text/csv",
	".gif": "image/gif",
	".htm": "text/html",
	".html": "text/html",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "text/javascript",
	".json": "application/json",
	".jsx": "text/javascript",
	".md": "text/markdown",
	".mdx": "text/markdown",
	".pdf": "application/pdf",
	".png": "image/png",
	".scss": "text/css",
	".ts": "text/plain",
	".tsx": "text/plain",
	".txt": "text/plain",
	".toml": "application/toml",
	".webp": "image/webp",
	".xml": "application/xml",
	".yaml": "application/x-yaml",
	".yml": "application/x-yaml",
};

const MIME_EXTENSIONS: Record<string, string> = {
	"application/json": ".json",
	"application/pdf": ".pdf",
	"application/toml": ".toml",
	"application/x-yaml": ".yaml",
	"application/xml": ".xml",
	"image/avif": ".avif",
	"image/gif": ".gif",
	"image/jpeg": ".jpg",
	"image/png": ".png",
	"image/webp": ".webp",
	"text/css": ".css",
	"text/csv": ".csv",
	"text/html": ".html",
	"text/javascript": ".js",
	"text/markdown": ".md",
	"text/plain": ".txt",
	"text/xml": ".xml",
};

export function normalizeAttachmentMimeType(value: unknown) {
	if (typeof value !== "string") {
		return undefined;
	}
	const mimeType = value.trim().toLowerCase();
	return mimeType || undefined;
}

export function inferAttachmentMimeType(input: {
	name?: string;
	path?: string;
	mimeType?: string;
}) {
	const explicit = normalizeAttachmentMimeType(input.mimeType);
	if (explicit) {
		return explicit;
	}
	const source = input.name || input.path || "";
	const extension = source.match(/\.[^.\\/]+$/u)?.[0]?.toLowerCase();
	return extension ? EXTENSION_MIME_TYPES[extension] : undefined;
}

export function isImageAttachmentMimeType(mimeType: string | undefined) {
	return Boolean(mimeType?.startsWith("image/"));
}

export function isSupportedAttachmentMimeType(mimeType: string | undefined) {
	if (!mimeType) {
		return false;
	}
	return (
		SUPPORTED_ATTACHMENT_MIME_TYPES.has(mimeType) ||
		mimeType.startsWith("text/")
	);
}

export function attachmentExtensionForMimeType(mimeType: string | undefined) {
	return mimeType ? MIME_EXTENSIONS[mimeType] : undefined;
}

export function formatAttachmentLimitBytes(bytes: number) {
	const mb = bytes / (1024 * 1024);
	return `${Number.isInteger(mb) ? mb.toFixed(0) : mb.toFixed(1)} MB`;
}
