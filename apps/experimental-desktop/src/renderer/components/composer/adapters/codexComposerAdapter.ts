import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerPayload } from "../composerPayload";
import { buildComposerProviderInput } from "../composerProviderInput";
import type { CodexProviderSendInput } from "../core/composerProviderTypes";

export function buildCodexProviderSendInput(input: {
	payload: ComposerPayload;
	model: string;
	runtimeMode: CodexRuntimeMode;
}): CodexProviderSendInput {
	const providerInput = buildComposerProviderInput(input.payload);
	return {
		provider: "codex",
		prompt: providerInput.text,
		nativeInput: providerInput.nativeInput,
		runtimeMode: input.runtimeMode,
		model: input.model,
		legacyPayload: providerInput.payload,
	};
}
