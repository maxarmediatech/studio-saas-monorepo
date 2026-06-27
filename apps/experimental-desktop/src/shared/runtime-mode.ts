export type CodexRuntimeMode = "read-only" | "workspace-write" | "full-access";

export const codexRuntimeModes: readonly CodexRuntimeMode[] = [
	"read-only",
	"workspace-write",
	"full-access",
];

export function isCodexRuntimeMode(value: unknown): value is CodexRuntimeMode {
	return (
		typeof value === "string" &&
		codexRuntimeModes.includes(value as CodexRuntimeMode)
	);
}

export function normalizeCodexRuntimeMode(
	value: unknown,
	fallback: CodexRuntimeMode = "read-only",
): CodexRuntimeMode {
	return isCodexRuntimeMode(value) ? value : fallback;
}
