export type ComposerTarget =
	| { kind: "draft"; id: string }
	| { kind: "conversation"; id: string };

export type ComposerTargetKind = ComposerTarget["kind"];

export const internalDraftIdPrefixes = [
	"composer:",
	"conversation:",
	"capture:",
] as const;

const MAX_TARGET_ID_LENGTH = 200;
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function targetKeyForComposerTarget(target: ComposerTarget): string {
	return `${target.kind}:${target.id}`;
}

export function draftIdForComposerTarget(target: ComposerTarget): string {
	if (target.kind === "conversation") {
		return `composer:conversation:${target.id}`;
	}
	return target.id;
}

export function parseComposerTarget(input: unknown): ComposerTarget {
	if (!input || typeof input !== "object") {
		throw new Error("Composer target is required");
	}
	const kind = (input as { kind?: unknown }).kind;
	const id = (input as { id?: unknown }).id;
	if (kind !== "draft" && kind !== "conversation") {
		throw new Error("Unsupported composer target kind");
	}
	if (typeof id !== "string") {
		throw new Error("Composer target id is required");
	}
	return validateComposerTarget({ kind, id } as ComposerTarget);
}

export function validateComposerTarget(target: ComposerTarget): ComposerTarget {
	const id = target.id.trim();
	if (!id) {
		throw new Error("Composer target id is required");
	}
	if (id.length > MAX_TARGET_ID_LENGTH) {
		throw new Error("Composer target id is too long");
	}
	if (target.kind === "draft") {
		validateRouteDraftId(id);
		return { kind: "draft", id };
	}
	if (!UUID_PATTERN.test(id)) {
		throw new Error("Conversation composer target id must be a UUID");
	}
	return { kind: "conversation", id };
}

export function validateRouteDraftId(id: string): string {
	const trimmed = id.trim();
	if (!trimmed) {
		throw new Error("Draft id is required");
	}
	if (trimmed.length > MAX_TARGET_ID_LENGTH) {
		throw new Error("Draft id is too long");
	}
	const reservedPrefix = internalDraftIdPrefixes.find((prefix) =>
		trimmed.startsWith(prefix),
	);
	if (reservedPrefix) {
		throw new Error(
			`Draft id uses reserved internal prefix: ${reservedPrefix}`,
		);
	}
	if (!UUID_PATTERN.test(trimmed)) {
		throw new Error("Route draft id must be a UUID");
	}
	return trimmed;
}

export function isReservedDraftId(id: string): boolean {
	return internalDraftIdPrefixes.some((prefix) => id.startsWith(prefix));
}
