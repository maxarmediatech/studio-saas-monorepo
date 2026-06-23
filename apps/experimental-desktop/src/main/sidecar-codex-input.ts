import { stat } from "node:fs/promises";
import {
	formatAttachmentLimitBytes,
	isImageAttachmentMimeType,
	isSupportedAttachmentMimeType,
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
				path: record.path,
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
