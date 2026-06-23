export type RuntimeCapabilityMap = {
	provider: "codex";
	supportsShell: boolean;
	supportsAttachments: boolean;
	supportsContext: boolean;
};

export const codexRuntimeCapabilities: RuntimeCapabilityMap = {
	provider: "codex",
	supportsShell: false,
	supportsAttachments: true,
	supportsContext: true,
};
