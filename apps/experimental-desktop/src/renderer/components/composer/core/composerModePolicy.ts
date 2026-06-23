import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerPayload } from "../composerPayload";
import type { RuntimeCapabilityMap } from "./runtimeCapabilityMap";

export type ComposerModePolicyResult = {
	ok: boolean;
	runtimeMode: CodexRuntimeMode;
	warnings: string[];
	capabilityWarnings: string[];
	blocks: string[];
};

export function resolveComposerModePolicy(input: {
	payload: ComposerPayload;
	runtimeMode: CodexRuntimeMode;
	capabilities: RuntimeCapabilityMap;
}): ComposerModePolicyResult {
	const warnings: string[] = [];
	const capabilityWarnings: string[] = [];
	const blocks: string[] = [];
	let runtimeMode = input.runtimeMode;

	if (
		input.payload.mode === "ask" ||
		input.payload.mode === "plan" ||
		input.payload.mode === "review"
	) {
		if (runtimeMode !== "read-only") {
			warnings.push(`${input.payload.mode} mode runs read-only.`);
		}
		runtimeMode = "read-only";
	}

	if (input.payload.mode === "build" && runtimeMode === "full-access") {
		warnings.push("Build is using explicitly selected full access.");
	}

	if (input.payload.mode === "shell") {
		if (!input.capabilities.supportsShell) {
			blocks.push(
				"Shell mode is not supported by the selected provider yet.",
			);
		}
		if (input.payload.contextItems.length > 0) {
			blocks.push("Shell mode cannot send context yet.");
		}
		if (input.payload.attachments.length > 0) {
			blocks.push("Shell mode cannot send attachments yet.");
		}
	}

	if (
		!input.capabilities.supportsAttachments &&
		input.payload.attachments.length > 0
	) {
		capabilityWarnings.push(
			"Selected provider does not support attachments.",
		);
		blocks.push("Remove attachments before sending.");
	}

	if (
		!input.capabilities.supportsContext &&
		input.payload.contextItems.length > 0
	) {
		capabilityWarnings.push("Selected provider does not support context.");
		blocks.push("Remove context before sending.");
	}

	return {
		ok: blocks.length === 0,
		runtimeMode,
		warnings,
		capabilityWarnings,
		blocks,
	};
}
