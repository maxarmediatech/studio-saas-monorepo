export type ComposerMode = "ask" | "plan" | "build" | "review" | "shell";

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
	action: "insert" | "mode" | "new-session" | "clear";
	insertText?: string;
	mode?: ComposerMode;
};

export const composerCommands: ComposerCommand[] = [
	{
		id: "ask",
		trigger: "ask",
		label: "Ask",
		description: "Ask without changing files.",
		action: "mode",
		mode: "ask",
	},
	{
		id: "plan",
		trigger: "plan",
		label: "Plan",
		description: "Plan first and wait.",
		action: "mode",
		mode: "plan",
	},
	{
		id: "build",
		trigger: "build",
		label: "Build",
		description: "Make changes and validate.",
		action: "mode",
		mode: "build",
	},
	{
		id: "review",
		trigger: "review",
		label: "Review",
		description: "Inspect risks and issues.",
		action: "mode",
		mode: "review",
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
		action: "mode",
		mode: "shell",
	},
	{
		id: "default",
		trigger: "default",
		label: "Ask",
		description: "Return to ask mode.",
		action: "mode",
		mode: "ask",
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
	switch (mode) {
		case "plan":
			return `Plan first, then wait for approval before editing:\n\n${trimmed}`;
		case "build":
			return `Make the requested changes, then run the relevant validation:\n\n${trimmed}`;
		case "review":
			return `Review the current context and report concrete risks, bugs, and missing validation. Do not edit files unless asked:\n\n${trimmed}`;
		case "shell":
			return `Run this shell command and report the result:\n\n\`\`\`sh\n${trimmed}\n\`\`\``;
		case "ask":
			return trimmed;
	}
}

export function normalizeComposerMode(mode: string): ComposerMode {
	if (
		mode === "ask" ||
		mode === "plan" ||
		mode === "build" ||
		mode === "review" ||
		mode === "shell"
	) {
		return mode;
	}
	return "ask";
}
