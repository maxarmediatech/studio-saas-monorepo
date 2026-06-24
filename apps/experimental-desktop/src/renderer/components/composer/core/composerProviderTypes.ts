import type { CodexRuntimeMode } from "../../../../preload/types";
import type { ComposerPayload } from "../composerPayload";
import type { ComposerNativeInputPart } from "../composerProviderInput";
import type { ComposerMode } from "../composerTriggers";
import type { ComposerContextItem } from "../composerTypes";
import type { ComposerDraft } from "./composerDraftTypes";

export type ComposerRequestPart =
	| { type: "text"; text: string }
	| {
			type: "file_ref" | "image_ref";
			path: string;
			name: string;
			mimeType?: string;
	  }
	| {
			type: "folder_ref";
			path: string;
			label: string;
			mode?: ComposerContextItem["folderMode"];
	  }
	| {
			type: "context_ref";
			path: string;
			label: string;
			contextType: ComposerContextItem["type"];
	  };

export type RuntimeModeSelection = {
	provider: "codex";
	mode: CodexRuntimeMode;
	locked?: boolean;
};

export type ComposerDraftSnapshot = ComposerDraft;

export type CodexProviderSendInput = {
	provider: "codex";
	prompt: string;
	nativeInput: ComposerNativeInputPart[];
	runtimeMode: CodexRuntimeMode;
	model: string;
	legacyPayload: ReturnType<
		typeof import("../composerProviderInput").buildComposerProviderInput
	>["payload"];
};

export type ProviderSendInput = CodexProviderSendInput;

export type AdmittedComposerRequest = {
	id: string;
	draftSnapshot: ComposerDraftSnapshot;
	requestParts: ComposerRequestPart[];
	providerInput: ProviderSendInput;
	admission: {
		mode: ComposerMode;
		effectiveRuntime: RuntimeModeSelection;
		capabilityWarnings: string[];
		warnings: string[];
	};
	compatibilityPayload: ComposerPayload;
};
