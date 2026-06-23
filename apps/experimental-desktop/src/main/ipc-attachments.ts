import { randomUUID } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { app } from "electron";
import {
	attachmentExtensionForMimeType,
	formatAttachmentLimitBytes,
	inferAttachmentMimeType,
	isSupportedAttachmentMimeType,
	MAX_ATTACHMENT_SIZE_BYTES,
} from "../shared/composerAttachmentPolicy";

export async function writeAttachmentFile(input: unknown) {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		throw new Error("Attachment input must be an object");
	}
	const body = input as {
		data?: ArrayBuffer | ArrayBufferView;
		name?: string;
		mimeType?: string;
	};
	if (!(body.data instanceof ArrayBuffer) && !ArrayBuffer.isView(body.data)) {
		throw new Error("Attachment data is required");
	}
	const buffer = bufferFromAttachmentData(body.data);
	if (buffer.byteLength === 0) {
		throw new Error("Attachment data is empty");
	}
	if (buffer.byteLength > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error(
			`Attachment is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}`,
		);
	}
	const mimeType = inferAttachmentMimeType({
		name: body.name,
		mimeType: body.mimeType,
	});
	if (!isSupportedAttachmentMimeType(mimeType)) {
		throw new Error("Unsupported attachment type");
	}
	const extension = attachmentExtension(body.name, mimeType);
	const name = safeAttachmentName(body.name, extension);
	const directory = join(app.getPath("userData"), "composer-attachments");
	await mkdir(directory, { recursive: true });
	const path = join(directory, `${randomUUID()}-${name}`);
	await writeFile(path, buffer);
	return {
		path,
		name,
		mimeType,
		size: buffer.byteLength,
	};
}

export async function getAttachmentFileInfo(path: unknown) {
	if (typeof path !== "string" || !path.trim()) {
		throw new Error("Attachment path is required");
	}
	const resolvedPath = resolve(path);
	const info = await stat(resolvedPath);
	if (!info.isFile()) {
		throw new Error("Attachment path must be a file");
	}
	if (info.size > MAX_ATTACHMENT_SIZE_BYTES) {
		throw new Error(
			`Attachment is larger than ${formatAttachmentLimitBytes(MAX_ATTACHMENT_SIZE_BYTES)}`,
		);
	}
	const mimeType = inferAttachmentMimeType({ path: resolvedPath });
	if (!isSupportedAttachmentMimeType(mimeType)) {
		throw new Error("Unsupported attachment type");
	}
	return {
		path: resolvedPath,
		name: basename(resolvedPath),
		mimeType,
		size: info.size,
	};
}

function bufferFromAttachmentData(data: ArrayBuffer | ArrayBufferView) {
	if (data instanceof ArrayBuffer) {
		return Buffer.from(data);
	}
	return Buffer.from(
		new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
	);
}

function safeAttachmentName(name: unknown, extension: string) {
	const raw =
		typeof name === "string" && name.trim() ? basename(name.trim()) : "";
	const withoutUnsafe = raw.replace(/[^a-zA-Z0-9._-]/g, "-");
	if (withoutUnsafe) {
		return withoutUnsafe.includes(".")
			? withoutUnsafe
			: `${withoutUnsafe}${extension}`;
	}
	return `clipboard${extension}`;
}

function attachmentExtension(name: unknown, mimeType: string | undefined) {
	if (typeof name === "string") {
		const extension = extname(name);
		if (extension) {
			return extension;
		}
	}
	return attachmentExtensionForMimeType(mimeType) ?? ".bin";
}
