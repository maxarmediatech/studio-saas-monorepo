import { readFile, stat } from "node:fs/promises";
import {
	formatAttachmentLimitBytes,
	isImageAttachmentMimeType,
	MAX_ATTACHMENT_SIZE_BYTES,
	MAX_COMPOSER_ATTACHMENTS,
} from "../shared/composerAttachmentPolicy";

export async function buildCodexTurnInput(input: {
	text: string;
	nativeInput?: unknown[];
}) {
	const nativeInput = input.nativeInput?.length
		? input.nativeInput
		: [{ type: "text", text: input.text }];
	const parts = [];
	let imageCount = 0;
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
			imageCount += 1;
			if (imageCount > MAX_COMPOSER_ATTACHMENTS) {
				throw new Error(
					`You can attach up to ${MAX_COMPOSER_ATTACHMENTS} images per message.`,
				);
			}
			parts.push({
				type: "input_image",
				image_url: await imageDataUrl(record.path, record.mimeType),
			});
		}
	}
	return parts.length ? parts : [{ type: "text", text: input.text }];
}

async function imageDataUrl(path: string, mimeType: string) {
	if (!isImageAttachmentMimeType(mimeType)) {
		throw new Error("Native image input must use an image MIME type.");
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
	const buffer = await readFile(path);
	return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

function basenameFromPath(path: string) {
	return path.slice(
		Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1,
	);
}
