import type { CodexRuntimeMode } from "../../../../preload/types";
import { buildCodexProviderSendInput } from "../adapters/codexComposerAdapter";
import type { ComposerPayload, ComposerPayloadPart } from "../composerPayload";
import type { ComposerContextItem } from "../composerTypes";
import { resolveComposerModePolicy } from "./composerModePolicy";
import type {
	AdmittedComposerRequest,
	ComposerRequestPart,
} from "./composerProviderTypes";
import { codexRuntimeCapabilities } from "./runtimeCapabilityMap";

export type ComposerAdmissionResult =
	| { ok: true; request: AdmittedComposerRequest }
	| { ok: false; reason: string; blocks: string[] };

export function admitComposerRequest(input: {
	payload: ComposerPayload;
	model: string;
	runtimeMode: CodexRuntimeMode;
	createId?: () => string;
}): ComposerAdmissionResult {
	const policy = resolveComposerModePolicy({
		payload: input.payload,
		runtimeMode: input.runtimeMode,
		capabilities: codexRuntimeCapabilities,
	});
	if (!policy.ok) {
		return {
			ok: false,
			reason: policy.blocks[0] ?? "Composer request blocked.",
			blocks: policy.blocks,
		};
	}

	const requestParts = buildComposerRequestParts(input.payload);
	if (requestParts.length === 0) {
		return {
			ok: false,
			reason: "Message required.",
			blocks: ["Message required."],
		};
	}

	const unresolvedAttachments = input.payload.attachments.filter(
		(attachment) =>
			attachment.status === "failed" ||
			!attachment.path ||
			!attachment.mimeType,
	);
	if (unresolvedAttachments.length > 0) {
		return {
			ok: false,
			reason: "Resolve attachments before sending.",
			blocks: unresolvedAttachments.map(
				(attachment) =>
					`${attachment.name}: ${attachmentIssue(attachment)}`,
			),
		};
	}

	const providerInput = buildCodexProviderSendInput({
		payload: input.payload,
		model: input.model,
		runtimeMode: policy.runtimeMode,
	});
	if (!providerInput.prompt.trim()) {
		return {
			ok: false,
			reason: "Message required.",
			blocks: ["Message required."],
		};
	}

	return {
		ok: true,
		request: {
			id: input.createId?.() ?? crypto.randomUUID(),
			draftSnapshot: {
				mode: input.payload.mode,
				text: input.payload.text,
				contextItems: input.payload.contextItems,
				attachments: input.payload.attachments,
			},
			requestParts,
			providerInput,
			admission: {
				mode: input.payload.mode,
				effectiveRuntime: {
					provider: "codex",
					mode: policy.runtimeMode,
				},
				capabilityWarnings: policy.capabilityWarnings,
				warnings: policy.warnings,
			},
			compatibilityPayload: input.payload,
		},
	};
}

function attachmentIssue(attachment: ComposerPayload["attachments"][number]) {
	if (attachment.error) {
		return attachment.error;
	}
	if (!attachment.path) {
		return "missing path";
	}
	if (!attachment.mimeType) {
		return "missing MIME type";
	}
	return "unresolved";
}

function buildComposerRequestParts(
	payload: ComposerPayload,
): ComposerRequestPart[] {
	return payload.parts.flatMap((part) => requestPartFromPayloadPart(part));
}

function requestPartFromPayloadPart(
	part: ComposerPayloadPart,
): ComposerRequestPart[] {
	switch (part.type) {
		case "user_text":
			return part.text.trim()
				? [{ type: "text", text: part.text.trim() }]
				: [];
		case "attachment_image":
			return part.path
				? [
						{
							type: "image_ref",
							path: part.path,
							name: part.name,
							mimeType: part.mimeType,
						},
					]
				: [];
		case "attachment_file":
			return part.path
				? [
						{
							type: "file_ref",
							path: part.path,
							name: part.name,
							mimeType: part.mimeType,
						},
					]
				: [];
		case "context_directory":
		case "context_workspace":
			return [
				{
					type: "folder_ref",
					path: part.path,
					label: part.label,
					mode: part.folderMode,
				},
			];
		case "context_file":
		case "context_skill":
		case "context_terminal":
			return [
				{
					type: "context_ref",
					path: part.path,
					label: part.label,
					contextType: contextTypeFromPartType(part.type),
				},
			];
	}
}

function contextTypeFromPartType(
	type: Extract<ComposerPayloadPart, { type: `context_${string}` }>["type"],
): ComposerContextItem["type"] {
	switch (type) {
		case "context_file":
			return "file";
		case "context_directory":
			return "directory";
		case "context_workspace":
			return "workspace";
		case "context_skill":
			return "skill";
		case "context_terminal":
			return "terminal";
	}
}
