import type { CodexRuntimeMode } from "../sidecar-codex-runtime";
import { validateObject } from "./controller-utils";

export type ComposerRequestPart =
	| { type: "text"; text: string }
	| { type: "file_ref" | "image_ref"; path: string; name: string; mimeType?: string }
	| { type: "folder_ref"; path: string; label: string; mode?: string }
	| { type: "context_ref"; path: string; label: string; contextType?: string };

export type CodexNativeInputPart =
	| { type: "text"; text: string }
	| { type: "local_image" | "local_file"; path: string; name: string; mimeType: string };

export type CodexAdmittedProviderInput = {
	provider: "codex";
	prompt: string;
	nativeInput: CodexNativeInputPart[];
	runtimeMode: CodexRuntimeMode;
	model: string;
	legacyPayload?: unknown;
};

export type ValidatedAdmittedComposerRequest = {
	id: string;
	draftSnapshot: unknown;
	requestParts: ComposerRequestPart[];
	providerInput: CodexAdmittedProviderInput;
	admission: unknown;
	compatibilityPayload?: unknown;
};

export function validateAdmittedSendBody(value: unknown): {
	draftId?: string;
	cwd?: string;
	request: ValidatedAdmittedComposerRequest;
} {
	const body = validateObject(value, "Admitted send body must be an object");
	const request = validateAdmittedComposerRequest(body.request);
	return {
		...(typeof body.draftId === "string" && body.draftId.trim()
			? { draftId: body.draftId }
			: {}),
		...(typeof body.cwd === "string" && body.cwd.trim()
			? { cwd: body.cwd }
			: {}),
		request,
	};
}

export function validateAdmittedComposerRequest(
	value: unknown,
): ValidatedAdmittedComposerRequest {
	const request = validateObject(
		value,
		"Admitted request must be an object",
	);
	if (typeof request.id !== "string" || !request.id.trim()) {
		throw new Error("Admitted request id is required");
	}
	const requestParts = validateRequestParts(request.requestParts);
	const providerInput = validateCodexProviderInput(request.providerInput);
	validateProviderInputMatchesParts(providerInput, requestParts);
	return {
		id: request.id,
		draftSnapshot: request.draftSnapshot ?? {},
		requestParts,
		providerInput,
		admission: request.admission ?? {},
		compatibilityPayload: request.compatibilityPayload,
	};
}

export function validateQueueUpdateBody(value: unknown): {
	status?: "queued" | "running" | "completed" | "failed" | "canceled";
} {
	const body = validateObject(value, "Queue update body must be an object");
	if (body.status === undefined) {
		return {};
	}
	if (
		body.status === "queued" ||
		body.status === "running" ||
		body.status === "completed" ||
		body.status === "failed" ||
		body.status === "canceled"
	) {
		return { status: body.status };
	}
	throw new Error("Unsupported queue status");
}

function validateRequestParts(value: unknown): ComposerRequestPart[] {
	if (!Array.isArray(value)) {
		throw new Error("Admitted request parts must be an array");
	}
	return value.map((part, index) => validateRequestPart(part, index));
}

function validateRequestPart(value: unknown, index: number): ComposerRequestPart {
	const part = validateObject(
		value,
		`Admitted request part ${index} must be an object`,
	);
	if (part.type === "text") {
		if (typeof part.text !== "string") {
			throw new Error(`Admitted text part ${index} is invalid`);
		}
		return { type: "text", text: part.text };
	}
	if (part.type === "file_ref" || part.type === "image_ref") {
		const path = readRequiredString(part.path, `part ${index} path`);
		const name = readRequiredString(part.name, `part ${index} name`);
		return {
			type: part.type,
			path,
			name,
			...(typeof part.mimeType === "string" && part.mimeType.trim()
				? { mimeType: part.mimeType }
				: {}),
		};
	}
	if (part.type === "folder_ref") {
		return {
			type: "folder_ref",
			path: readRequiredString(part.path, `part ${index} path`),
			label: readRequiredString(part.label, `part ${index} label`),
			...(typeof part.mode === "string" ? { mode: part.mode } : {}),
		};
	}
	if (part.type === "context_ref") {
		return {
			type: "context_ref",
			path: readRequiredString(part.path, `part ${index} path`),
			label: readRequiredString(part.label, `part ${index} label`),
			...(typeof part.contextType === "string"
				? { contextType: part.contextType }
				: {}),
		};
	}
	throw new Error(`Unsupported admitted request part type at ${index}`);
}

function validateCodexProviderInput(value: unknown): CodexAdmittedProviderInput {
	const input = validateObject(
		value,
		"Provider input must be an object",
	);
	if (input.provider !== "codex") {
		throw new Error(`Unsupported provider: ${String(input.provider)}`);
	}
	const prompt = readRequiredString(input.prompt, "provider prompt").trim();
	if (!prompt) {
		throw new Error("Provider prompt is required");
	}
	return {
		provider: "codex",
		prompt,
		nativeInput: Array.isArray(input.nativeInput)
			? input.nativeInput.map(validateNativeInputPart)
			: [],
		runtimeMode: validateRuntimeMode(input.runtimeMode),
		model: readRequiredString(input.model, "provider model"),
		legacyPayload: input.legacyPayload,
	};
}

function validateNativeInputPart(value: unknown): CodexNativeInputPart {
	const part = validateObject(value, "Native input part must be an object");
	if (part.type === "text") {
		return { type: "text", text: readRequiredString(part.text, "native text") };
	}
	if (part.type === "local_image" || part.type === "local_file") {
		return {
			type: part.type,
			path: readRequiredString(part.path, "native path"),
			name: readRequiredString(part.name, "native name"),
			mimeType: readRequiredString(part.mimeType, "native MIME type"),
		};
	}
	throw new Error("Unsupported native input part type");
}

function validateProviderInputMatchesParts(
	providerInput: CodexAdmittedProviderInput,
	requestParts: ComposerRequestPart[],
) {
	const refs = new Map(
		requestParts
			.filter(isFileOrImageRequestPart)
			.map((part) => [part.path, part]),
	);
	for (const nativePart of providerInput.nativeInput) {
		if (nativePart.type === "text") {
			continue;
		}
		const requestPart = refs.get(nativePart.path);
		if (!requestPart) {
			throw new Error("Provider native input contains an unadmitted file path");
		}
		if (nativePart.type === "local_image" && requestPart.type !== "image_ref") {
			throw new Error("Provider image input must match an image request part");
		}
		if (nativePart.type === "local_file" && requestPart.type !== "file_ref") {
			throw new Error("Provider file input must match a file request part");
		}
		if (requestPart.mimeType && requestPart.mimeType !== nativePart.mimeType) {
			throw new Error("Provider native input MIME type does not match request part");
		}
		if (requestPart.name !== nativePart.name) {
			throw new Error("Provider native input name does not match request part");
		}
	}
}

function isFileOrImageRequestPart(
	part: ComposerRequestPart,
): part is Extract<ComposerRequestPart, { type: "file_ref" | "image_ref" }> {
	return part.type === "file_ref" || part.type === "image_ref";
}

function validateRuntimeMode(value: unknown): CodexRuntimeMode {
	if (
		value === "read-only" ||
		value === "workspace-write" ||
		value === "full-access"
	) {
		return value;
	}
	throw new Error("Unsupported runtime mode");
}

function readRequiredString(value: unknown, label: string) {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${label} is required`);
	}
	return value;
}
