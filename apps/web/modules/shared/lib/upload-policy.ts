type UploadFileRule = {
	label: string;
	mimeType: string;
	extensions: string[];
};

type UploadPolicy = {
	maxFileSize: number;
	files: UploadFileRule[];
};

export const UPLOAD_CONTEXT_VALUES = [
	"contracts",
	"payments",
	"deliverables",
	"submissions",
	"shoots",
	"receipts",
	"documents",
	"avatars",
	"org-logos",
] as const;

export type UploadContext = (typeof UPLOAD_CONTEXT_VALUES)[number];

export const USER_LEVEL_UPLOAD_CONTEXTS: UploadContext[] = ["avatars"];

const MB = 1024 * 1024;

const uploadPolicies: Record<UploadContext, UploadPolicy> = {
	contracts: {
		maxFileSize: 10 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "WEBP", mimeType: "image/webp", extensions: [".webp"] },
		],
	},
	payments: {
		maxFileSize: 5 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "WEBP", mimeType: "image/webp", extensions: [".webp"] },
		],
	},
	deliverables: {
		maxFileSize: 100 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
			{ label: "ZIP", mimeType: "application/zip", extensions: [".zip"] },
		],
	},
	submissions: {
		maxFileSize: 100 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
			{ label: "ZIP", mimeType: "application/zip", extensions: [".zip"] },
		],
	},
	shoots: {
		maxFileSize: 100 * MB,
		files: [
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "WEBP", mimeType: "image/webp", extensions: [".webp"] },
			{ label: "MP4", mimeType: "video/mp4", extensions: [".mp4"] },
		],
	},
	receipts: {
		maxFileSize: 5 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{ label: "WEBP", mimeType: "image/webp", extensions: [".webp"] },
		],
	},
	documents: {
		maxFileSize: 25 * MB,
		files: [
			{ label: "PDF", mimeType: "application/pdf", extensions: [".pdf"] },
			{
				label: "DOC",
				mimeType: "application/msword",
				extensions: [".doc"],
			},
			{
				label: "DOCX",
				mimeType:
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				extensions: [".docx"],
			},
		],
	},
	avatars: {
		maxFileSize: 2 * MB,
		files: [
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
		],
	},
	"org-logos": {
		maxFileSize: 2 * MB,
		files: [
			{ label: "PNG", mimeType: "image/png", extensions: [".png"] },
			{
				label: "JPG",
				mimeType: "image/jpeg",
				extensions: [".jpg", ".jpeg"],
			},
		],
	},
};

export const MIME_TO_EXT = Object.fromEntries(
	Object.values(uploadPolicies)
		.flatMap((policy) =>
			policy.files.map((file) => [
				file.mimeType,
				file.extensions[0]?.slice(1),
			]),
		)
		.filter(
			(entry, index, entries) =>
				entries.findIndex(([mimeType]) => mimeType === entry[0]) ===
				index,
		),
) as Record<string, string>;

export function getUploadPolicy(context: UploadContext) {
	return uploadPolicies[context];
}

export function requiresOrganizationForUpload(context: UploadContext) {
	return !USER_LEVEL_UPLOAD_CONTEXTS.includes(context);
}

export function formatUploadFileSize(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < MB) {
		return `${(bytes / 1024).toFixed(1)} KB`;
	}
	return `${(bytes / MB).toFixed(0)} MB`;
}

export function getUploadAccept(context: UploadContext) {
	return getUploadPolicy(context)
		.files.flatMap((file) => file.extensions)
		.join(",");
}

export function getUploadDropzoneAccept(context: UploadContext) {
	return Object.fromEntries(
		getUploadPolicy(context).files.map((file) => [
			file.mimeType,
			file.extensions,
		]),
	);
}

export function getUploadAllowedMimeTypes(context: UploadContext) {
	return getUploadPolicy(context).files.map((file) => file.mimeType);
}

export function getUploadAllowedTypeLabels(context: UploadContext) {
	return getUploadPolicy(context).files.map((file) => file.label);
}

export function getUploadHelperText(context: UploadContext) {
	const labels = getUploadAllowedTypeLabels(context).join(", ");
	return `${labels} up to ${formatUploadFileSize(
		getUploadPolicy(context).maxFileSize,
	)}.`;
}

export function getUploadInvalidTypeMessage(context: UploadContext) {
	return `Unsupported file type. Allowed: ${getUploadAllowedTypeLabels(
		context,
	).join(", ")}.`;
}

export function getUploadTooLargeMessage(context: UploadContext) {
	return `File too large. Maximum size: ${formatUploadFileSize(
		getUploadPolicy(context).maxFileSize,
	)}.`;
}

export function validateUploadFile(
	file: {
		name: string;
		type: string;
		size: number;
	},
	context: UploadContext,
) {
	const policy = getUploadPolicy(context);

	if (file.size > policy.maxFileSize) {
		return getUploadTooLargeMessage(context);
	}

	const allowedMimeTypes = getUploadAllowedMimeTypes(context);
	if (!allowedMimeTypes.includes(file.type)) {
		return getUploadInvalidTypeMessage(context);
	}

	return null;
}

export async function getUploadResponseErrorMessage(
	response: Response,
	fallbackMessage: string,
) {
	try {
		const data = (await response.json()) as
			| { message?: string }
			| undefined;
		return data?.message || fallbackMessage;
	} catch {
		return fallbackMessage;
	}
}
