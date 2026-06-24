import type { CodexRuntimeMode } from "../../../../preload/types";
import { buildCodexProviderSendInput } from "../adapters/codexComposerAdapter";
import {
	buildComposerPayload,
	type ComposerPayload,
} from "../composerPayload";
import { resolveComposerModePolicy } from "./composerModePolicy";
import type { ComposerDraft } from "./composerDraftTypes";
import { buildComposerRequestParts } from "./composerRequestParts";
import type { AdmittedComposerRequest } from "./composerProviderTypes";
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
	return admitComposerDraft({
		draft: {
			version: 1,
			text: input.payload.text,
			mode: input.payload.mode,
			model: input.model,
			runtimeMode: input.runtimeMode,
			contextItems: input.payload.contextItems,
			attachments: input.payload.attachments,
			updatedAt: Date.now(),
		},
		createId: input.createId,
	});
}

export function admitComposerDraft(input: {
	draft: ComposerDraft;
	createId?: () => string;
}): ComposerAdmissionResult {
	const payload = buildComposerPayload({
		mode: input.draft.mode,
		text: input.draft.text,
		contextItems: input.draft.contextItems,
		attachments: input.draft.attachments,
	});
	const policy = resolveComposerModePolicy({
		payload,
		runtimeMode: input.draft.runtimeMode,
		capabilities: codexRuntimeCapabilities,
	});
	if (!policy.ok) {
		return {
			ok: false,
			reason: policy.blocks[0] ?? "Composer request blocked.",
			blocks: policy.blocks,
		};
	}

	const unresolvedAttachments = payload.attachments.filter(
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

	const requestParts = buildComposerRequestParts(payload);
	if (requestParts.length === 0) {
		return {
			ok: false,
			reason: "Message required.",
			blocks: ["Message required."],
		};
	}

	const providerInput = buildCodexProviderSendInput({
		payload,
		model: input.draft.model,
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
			draftSnapshot: input.draft,
			requestParts,
			providerInput,
			admission: {
				mode: input.draft.mode,
				effectiveRuntime: {
					provider: "codex",
					mode: policy.runtimeMode,
				},
				capabilityWarnings: policy.capabilityWarnings,
				warnings: policy.warnings,
			},
			compatibilityPayload: payload,
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
