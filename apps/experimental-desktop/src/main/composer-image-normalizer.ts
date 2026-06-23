import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, nativeImage } from "electron";
import { isProviderNativeImageMimeType } from "../shared/composerAttachmentPolicy";

const MAX_PROVIDER_IMAGE_DIMENSION = 2000;
const JPEG_QUALITY = 88;

export type NormalizedLocalImageAttachment = {
	path: string;
	mimeType: string;
	normalized: boolean;
};

export async function normalizeLocalImageAttachment(input: {
	path: string;
	mimeType: string;
}): Promise<NormalizedLocalImageAttachment> {
	if (isProviderNativeImageMimeType(input.mimeType)) {
		return {
			path: input.path,
			mimeType: input.mimeType,
			normalized: false,
		};
	}
	const image = await readImage(input.path);
	if (image.isEmpty()) {
		throw new Error(
			`Image "${basenameFromPath(input.path)}" uses ${input.mimeType}, which cannot be decoded for provider input.`,
		);
	}
	const outputPath = await normalizedImagePath();
	await writeFile(outputPath, normalizeImage(image).toJPEG(JPEG_QUALITY));
	return {
		path: outputPath,
		mimeType: "image/jpeg",
		normalized: true,
	};
}

async function readImage(filePath: string) {
	const image = nativeImage.createFromPath(filePath);
	if (!image.isEmpty()) {
		return image;
	}
	return nativeImage.createThumbnailFromPath(filePath, {
		width: MAX_PROVIDER_IMAGE_DIMENSION,
		height: MAX_PROVIDER_IMAGE_DIMENSION,
	});
}

function normalizeImage(image: Electron.NativeImage) {
	const size = image.getSize();
	const scale = Math.min(
		1,
		MAX_PROVIDER_IMAGE_DIMENSION / size.width,
		MAX_PROVIDER_IMAGE_DIMENSION / size.height,
	);
	if (scale >= 1) {
		return image;
	}
	return image.resize({
		width: Math.max(1, Math.round(size.width * scale)),
		height: Math.max(1, Math.round(size.height * scale)),
	});
}

async function normalizedImagePath() {
	const outputDir = path.join(
		app.getPath("userData"),
		"composer-attachments",
		"normalized-images",
	);
	await mkdir(outputDir, { recursive: true });
	return path.join(outputDir, `${randomUUID()}.jpg`);
}

function basenameFromPath(filePath: string) {
	return filePath.slice(
		Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\")) + 1,
	);
}
