export type ComposerMode = "normal" | "shell";

export type ComposerTriggerKind = "slash" | "file" | "skill" | "terminal";

export type ComposerTrigger = {
	kind: ComposerTriggerKind;
	query: string;
	rangeStart: number;
	rangeEnd: number;
};

export type ComposerCommand = {
	id: string;
	trigger: string;
	label: string;
	description: string;
	action: "insert" | "new-session" | "clear" | "shell" | "normal";
	insertText?: string;
};

export const composerCommands: ComposerCommand[] = [
	{
		id: "plan",
		trigger: "plan",
		label: "Plan",
		description: "Ask Codex to reason before editing.",
		action: "insert",
		insertText: "Plan first, then wait for approval: ",
	},
	{
		id: "build",
		trigger: "build",
		label: "Build",
		description: "Move directly into implementation.",
		action: "insert",
		insertText: "Build this now: ",
	},
	{
		id: "review",
		trigger: "review",
		label: "Review",
		description: "Inspect current Electron app changes.",
		action: "insert",
		insertText: "Review the Electron app composer changes: ",
	},
	{
		id: "fix",
		trigger: "fix",
		label: "Fix",
		description: "Find root cause and patch it.",
		action: "insert",
		insertText: "Find the root cause and fix: ",
	},
	{
		id: "test",
		trigger: "test",
		label: "Test",
		description: "Run focused validation.",
		action: "insert",
		insertText: "Run the relevant Electron validation for: ",
	},
	{
		id: "status",
		trigger: "status",
		label: "Status",
		description: "Summarize runtime and current work.",
		action: "insert",
		insertText: "Summarize current runtime status and pending work.",
	},
	{
		id: "shell",
		trigger: "shell",
		label: "Shell",
		description: "Switch composer into command mode.",
		action: "shell",
	},
	{
		id: "default",
		trigger: "default",
		label: "Default",
		description: "Return to normal prompt mode.",
		action: "normal",
	},
	{
		id: "new",
		trigger: "new",
		label: "New",
		description: "Start a fresh session.",
		action: "new-session",
	},
	{
		id: "clear",
		trigger: "clear",
		label: "Clear",
		description: "Clear the composer draft.",
		action: "clear",
	},
];

function clampCursor(text: string, cursor: number): number {
	if (!Number.isFinite(cursor)) {
		return text.length;
	}
	return Math.max(0, Math.min(text.length, Math.floor(cursor)));
}

function isBoundary(char: string): boolean {
	return char === " " || char === "\n" || char === "\t" || char === "\r";
}

export function detectComposerTrigger(
	text: string,
	cursorInput: number,
): ComposerTrigger | null {
	const cursor = clampCursor(text, cursorInput);
	const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
	const linePrefix = text.slice(lineStart, cursor);

	if (linePrefix.startsWith("/")) {
		const match = /^\/([a-zA-Z0-9_-]*)$/.exec(linePrefix);
		if (match) {
			return {
				kind: "slash",
				query: match[1] ?? "",
				rangeStart: lineStart,
				rangeEnd: cursor,
			};
		}
	}

	let tokenStart = cursor - 1;
	while (tokenStart >= 0 && !isBoundary(text[tokenStart] ?? "")) {
		tokenStart -= 1;
	}
	tokenStart += 1;

	const token = text.slice(tokenStart, cursor);
	if (token.startsWith("@")) {
		return {
			kind: "file",
			query: token.slice(1),
			rangeStart: tokenStart,
			rangeEnd: cursor,
		};
	}
	if (token.startsWith("$")) {
		return {
			kind: "skill",
			query: token.slice(1),
			rangeStart: tokenStart,
			rangeEnd: cursor,
		};
	}
	if (token.startsWith(">")) {
		return {
			kind: "terminal",
			query: token.slice(1),
			rangeStart: tokenStart,
			rangeEnd: cursor,
		};
	}
	return null;
}

export function replaceComposerRange(
	text: string,
	rangeStart: number,
	rangeEnd: number,
	replacement: string,
) {
	const start = Math.max(0, Math.min(text.length, rangeStart));
	const end = Math.max(start, Math.min(text.length, rangeEnd));
	const next = `${text.slice(0, start)}${replacement}${text.slice(end)}`;
	return { text: next, cursor: start + replacement.length };
}

export function serializeComposerSendText(text: string, mode: ComposerMode) {
	const trimmed = text.trim();
	if (mode === "shell") {
		return `Run this shell command and report the result:\n\n\`\`\`sh\n${trimmed}\n\`\`\``;
	}
	return trimmed;
}
