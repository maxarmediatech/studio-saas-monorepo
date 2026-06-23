import type { CodexRuntimeMode, ConversationDetail } from "../../preload/types";
import type { ComposerNativeInputPart } from "../components/composer/composerProviderInput";
import type { AdmittedComposerRequest } from "../components/composer/core/composerProviderTypes";

export type CodexAdmittedSendInput = {
	text: string;
	model: string;
	runtimeMode: CodexRuntimeMode;
	nativeInput: ComposerNativeInputPart[];
	payload: unknown;
};

export type CodexAdmittedTransport = {
	sendConversationMessage: (
		conversationId: string,
		input: CodexAdmittedSendInput,
	) => Promise<ConversationDetail | undefined>;
	promoteDraftAndSend: (
		input: CodexAdmittedSendInput & { draftId?: string; cwd?: string },
	) => Promise<ConversationDetail | undefined>;
};

export function toCodexAdmittedSendInput(
	request: AdmittedComposerRequest,
): CodexAdmittedSendInput {
	if (request.providerInput.provider !== "codex") {
		throw new Error(
			`Unsupported provider: ${request.providerInput.provider}`,
		);
	}
	return {
		text: request.providerInput.prompt,
		model: request.providerInput.model,
		runtimeMode: request.providerInput.runtimeMode,
		nativeInput: request.providerInput.nativeInput,
		payload: {
			...request.providerInput.legacyPayload,
			admittedRequest: {
				id: request.id,
				requestParts: request.requestParts,
				admission: request.admission,
			},
		},
	};
}
