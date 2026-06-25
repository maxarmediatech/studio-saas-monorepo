import type { ComposerMode } from "./composerTriggers";

export type ComposerPrimaryAction =
	| "send"
	| "queue"
	| "run-shell"
	| "stop"
	| "disabled";

export function resolvePrimaryAction(input: {
	mode: ComposerMode;
	disabled: boolean;
	turnActive: boolean;
	queueActive?: boolean;
	hasText: boolean;
	blocked?: boolean;
}): ComposerPrimaryAction {
	if (input.turnActive) {
		return "stop";
	}
	if (input.queueActive && input.hasText && !input.blocked) {
		return "queue";
	}
	if (input.disabled || input.blocked || !input.hasText) {
		return "disabled";
	}
	return input.mode === "shell" ? "run-shell" : "send";
}
