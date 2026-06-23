import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { app, nativeImage } from "electron";
import {
	formatAttachmentLimitBytes,
	isImageAttachmentMimeType,
	isSupportedAttachmentMimeType,
	MAX_ATTACHMENT_SIZE_BYTES,
	MAX_COMPOSER_ATTACHMENTS,
} from "../shared/composerAttachmentPolicy";

const execFileAsync = promisify(execFile);

export async function buildCodexTurnInput(input: {
	text: string;
	nativeInput?: unknown[];
}) {
	const nativeInput = input.nativeInput?.length
		? input.nativeInput
		: [{ type: "text", text: input.text }];
	const parts = [];
	let nativeAttachmentCount = 0;
	for (const part of nativeInput) {
		if (!part || typeof part !== "object" || Array.isArray(part)) {
			continue;
		}
		const record = part as Record<string, unknown>;
		if (record.type === "text" && typeof record.text === "string") {
			parts.push({ type: "text", text: record.text });
			continue;
		}
		if (
			record.type === "local_image" &&
			typeof record.path === "string" &&
			typeof record.mimeType === "string"
		) {
			nativeAttachmentCount += 1;
			assertNativeAttachmentCount(nativeAttachmentCount);
			await validateLocalAttachment(record.path, record.mimeType, {
				imageOnly: true,
			});
			parts.push({
				type: "localImage",
				path: await normalizeLocalImageAttachment(
					record.path,
					record.mimeType,
				),
			});
			continue;
		}
		if (
			record.type === "local_file" &&
			typeof record.path === "string" &&
			typeof record.name === "string" &&
			typeof record.mimeType === "string"
		) {
			nativeAttachmentCount += 1;
			assertNativeAttachmentCount(nativeAttachmentCount);
			await validateLocalAttachment(record.path, record.mimeType);
			parts.push({
				type: "mention",
				name: record.name,
				path: record.path,
			});
		}
	}
	return parts.length ? parts : [{ type: "text", text: input.text }];
}

async function normalizeLocalImageAttachment(
	filePath: string,
	mimeType: string,
) {
	if (mimeType !== "image/avif") {
		return filePath;
	}
	const outputDir = path.join(
		app.getPath("userData"),
		"composer-attachments",
		"normalized-images",
	);
	await mkdir(outputDir, { recursive: true });
	const outputPath = path.join(outputDir, `${randomUUID()}.jpg`);
	const image = nativeImage.createFromPath(filePath);
	if (image.isEmpty()) {
		await convertAvifWithSips(filePath, outputPath);
	} else {
		const size = image.getSize();
		const scale = Math.min(1, 2000 / size.width, 2000 / size.height);
		const normalized =
			scale < 1
				? image.resize({
						width: Math.max(1, Math.round(size.width * scale)),
						height: Math.max(1, Math.round(size.height * scale)),
					})
				: image;
		await writeFile(outputPath, normalized.toJPEG(88));
	}
	await validateLocalAttachment(outputPath, "image/jpeg", {
		imageOnly: true,
	});
	return outputPath;
}

async function convertAvifWithSips(filePath: string, outputPath: string) {
	if (process.platform !== "darwin") {
		throw new Error("Could not decode AVIF image attachment.");
	}
	await execFileAsync("sips", [
		"-Z",
		"2000",
		"-s",
		"format",
		"jpeg",
		filePath,
		"--out",
		outputPath,
	]).catch((error) => {
		throw new Error(
			error instanceof Error
				? `Could not decode AVIF image attachment. ${error.message}`
				: "Could not decode AVIF image attachment.",
		);
	});
}

function assertNativeAttachmentCount(count: number) {
	if (count > MAX_COMPOSER_ATTACHMENTS) {
		throw new Error(
			`You can attach up to ${MAX_COMPOSER_ATTACHMENTS} files per message.`,
		);
	}
}

async function validateLocalAttachment(
	path: string,
	mimeType: string,
	input?: { imageOnly?: boolean },
) {
	if (input?.imageOnly && !isImageAttachmentMimeType(mimeType)) {
		throw new Error("Native image input must use an image MIME type.");
	}
	if (!isSupportedAttachmentMimeType(mimeType)) {
		throw new Error("Native file input uses an unsupported MIME type.");
	}
	const info = await stat(path).catch(() => {
		throw new Error(
			`Attachment "${basenameFromPath(path)}" no longer exists. Remove it and retry.`,
		);
	});
	if (!info.isFile()) {
		throw new Error(
			`Attachment "${basenameFromPath(path)}" is not a readable file. Remove it and retry.`,
		);
	}
	if (info.size > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error(
			`Attachment "${basenameFromPath(path)}" is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}. Remove it and retry.`,
		);
	}
}

function basenameFromPath(path: string) {
	return path.slice(
		Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
	);
}
