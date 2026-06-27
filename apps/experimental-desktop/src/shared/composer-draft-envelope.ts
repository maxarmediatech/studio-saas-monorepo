import {
	type ComposerTarget,
	draftIdForComposerTarget,
	parseComposerTarget,
	validateComposerTarget,
} from "./composer-target";
import {
	type ComposerAttachment,
	type ComposerContextItem,
	type ComposerDraftInput,
	type DurableComposerAttachment,
	normalizeComposerMode,
} from "./composer-types";
import { normalizeCodexRuntimeMode } from "./runtime-mode";

export type ComposerDraftWarningCode =
	| "draft_parse_unknown_version"
	| "draft_parse_invalid_attachment"
	| "draft_parse_missing_envelope"
	| "draft_parse_rebuilt_legacy_payload"
	| "draft_restore_failure"
	| "draft_hydrate_stale_result_ignored"
	| "draft_flush_failed"
	| "draft_clear_suppressed_autosave"
	| "draft_promotion_idempotent_replay"
	| "draft_legacy_api_used"
	| "draft_approval_answers_expired_on_restart"
	| "draft_retention_compacted_promoted"
	| "draft_retention_deleted_discarded"
	| "queue_recovery_interrupted_running_item"
	| "queue_hydrate_duplicate_optimistic_item";

export type ComposerDraftEnvelopeV2 = {
	version: 2;
	target: ComposerTarget;
	input: ComposerDraftInput;
	pendingRequestAnswerDrafts: Record<string, Record<string, string>>;
	updatedAt: string;
};

export type ParsedComposerDraftEnvelope = {
	envelope: ComposerDraftEnvelopeV2;
	warnings: ComposerDraftWarningCode[];
};

export type LegacyDraftSource = {
	id: string;
	text?: string | null;
	model?: string | null;
	runtimeMode?: unknown;
	attachments?: unknown;
	payload?: unknown;
	updatedAt?: string | null;
};

export function createEmptyComposerDraftEnvelope(input: {
	target: ComposerTarget;
	updatedAt: string;
}): ComposerDraftEnvelopeV2 {
	const target = validateComposerTarget(input.target);
	return {
		version: 2,
		target,
		input: {
			text: "",
			mode: "ask",
			model: null,
			runtimeMode: "read-only",
			contextItems: [],
			attachments: [],
			selection: { start: 0, end: 0 },
			payload: {},
		},
		pendingRequestAnswerDrafts: {},
		updatedAt: input.updatedAt,
	};
}

export function normalizeComposerDraftEnvelope(input: {
	target: ComposerTarget;
	envelope: unknown;
	updatedAt: string;
}): ParsedComposerDraftEnvelope {
	const target = validateComposerTarget(input.target);
	const warnings: ComposerDraftWarningCode[] = [];
	if (!isObject(input.envelope)) {
		warnings.push("draft_parse_missing_envelope");
		return {
			envelope: createEmptyComposerDraftEnvelope({
				target,
				updatedAt: input.updatedAt,
			}),
			warnings,
		};
	}
	const version = input.envelope.version;
	if (version !== 2) {
		warnings.push("draft_parse_unknown_version");
		return {
			envelope: createEmptyComposerDraftEnvelope({
				target,
				updatedAt: input.updatedAt,
			}),
			warnings,
		};
	}
	const parsedTarget = parseComposerTarget(input.envelope.target);
	if (
		draftIdForComposerTarget(parsedTarget) !==
		draftIdForComposerTarget(target)
	) {
		throw new Error(
			"Composer draft envelope target does not match storage target",
		);
	}
	const normalized = normalizeInput(input.envelope.input, warnings);
	return {
		envelope: {
			version: 2,
			target,
			input: normalized,
			pendingRequestAnswerDrafts: normalizePendingAnswerDrafts(
				input.envelope.pendingRequestAnswerDrafts,
			),
			updatedAt:
				typeof input.envelope.updatedAt === "string"
					? input.envelope.updatedAt
					: input.updatedAt,
		},
		warnings,
	};
}

export function rebuildComposerDraftEnvelopeFromLegacy(
	input: LegacyDraftSource & { target: ComposerTarget },
): ParsedComposerDraftEnvelope {
	const warnings: ComposerDraftWarningCode[] = [
		"draft_parse_rebuilt_legacy_payload",
	];
	const payload = isObject(input.payload) ? input.payload : {};
	const contextItems = Array.isArray(payload.contextItems)
		? normalizeContextItems(payload.contextItems)
		: [];
	const attachmentsSource = Array.isArray(input.attachments)
		? input.attachments
		: Array.isArray(payload.attachments)
			? payload.attachments
			: [];
	const attachments = normalizeAttachments(attachmentsSource, warnings);
	return {
		envelope: {
			version: 2,
			target: validateComposerTarget(input.target),
			input: {
				text: typeof input.text === "string" ? input.text : "",
				mode: normalizeComposerMode(payload.mode),
				model: typeof input.model === "string" ? input.model : null,
				runtimeMode: normalizeCodexRuntimeMode(input.runtimeMode),
				contextItems,
				attachments,
				selection: normalizeSelection(payload.selection, input.text),
				payload,
			},
			pendingRequestAnswerDrafts: {},
			updatedAt: input.updatedAt ?? new Date(0).toISOString(),
		},
		warnings,
	};
}

export function stripNonDurableAttachmentFields(
	attachments: readonly ComposerAttachment[],
): DurableComposerAttachment[] {
	return attachments.map(({ previewUrl: _previewUrl, ...attachment }) => ({
		...attachment,
	}));
}

function normalizeInput(
	input: unknown,
	warnings: ComposerDraftWarningCode[],
): ComposerDraftInput {
	const object = isObject(input) ? input : {};
	return {
		text: typeof object.text === "string" ? object.text : "",
		mode: normalizeComposerMode(object.mode),
		model: typeof object.model === "string" ? object.model : null,
		runtimeMode: normalizeCodexRuntimeMode(object.runtimeMode),
		contextItems: normalizeContextItems(object.contextItems),
		attachments: normalizeAttachments(object.attachments, warnings),
		selection: normalizeSelection(object.selection, object.text),
		payload: object.payload ?? {},
	};
}

function normalizeContextItems(value: unknown): ComposerContextItem[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter(isComposerContextItem).map((item) => ({
		...item,
		path: normalizeContextPath(item.path),
	}));
}

function normalizeAttachments(
	value: unknown,
	warnings: ComposerDraftWarningCode[],
): DurableComposerAttachment[] {
	if (!Array.isArray(value)) {
		return [];
	}
	const attachments: DurableComposerAttachment[] = [];
	for (const item of value) {
		if (!isObject(item)) {
			warnings.push("draft_parse_invalid_attachment");
			continue;
		}
		const id = typeof item.id === "string" ? item.id : "";
		const kind =
			item.kind === "image" || item.kind === "file"
				? item.kind
				: undefined;
		const name = typeof item.name === "string" ? item.name : "";
		if (!id || !kind || !name) {
			warnings.push("draft_parse_invalid_attachment");
			continue;
		}
		const path = typeof item.path === "string" ? item.path : undefined;
		if (item.status !== "failed" && !path) {
			warnings.push("draft_parse_invalid_attachment");
			continue;
		}
		attachments.push({
			id,
			kind,
			name,
			...(path ? { path } : {}),
			...(typeof item.mimeType === "string"
				? { mimeType: item.mimeType }
				: {}),
			...(typeof item.size === "number" && Number.isFinite(item.size)
				? { size: item.size }
				: {}),
			...(item.status === "ready" || item.status === "failed"
				? { status: item.status }
				: {}),
			...(typeof item.error === "string" ? { error: item.error } : {}),
		});
	}
	return attachments;
}

function normalizeSelection(value: unknown, textValue: unknown) {
	const text = typeof textValue === "string" ? textValue : "";
	const length = text.length;
	if (!isObject(value)) {
		return { start: length, end: length };
	}
	const start = clampSelectionIndex(value.start, length);
	const end = clampSelectionIndex(value.end, length);
	return start <= end ? { start, end } : { start: end, end: start };
}

function clampSelectionIndex(value: unknown, length: number) {
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return length;
	}
	return Math.min(length, Math.max(0, Math.trunc(value)));
}

function normalizeContextPath(path: string) {
	const trimmed = path.trim().replaceAll("\\", "/");
	const prefix = trimmed.startsWith("/") ? "/" : "";
	return `${prefix}${trimmed
		.replace(/^\/+/, "")
		.split("/")
		.filter((part) => part.length > 0 && part !== ".")
		.join("/")}`;
}

function normalizePendingAnswerDrafts(
	value: unknown,
): Record<string, Record<string, string>> {
	if (!isObject(value)) {
		return {};
	}
	const result: Record<string, Record<string, string>> = {};
	for (const [requestId, answers] of Object.entries(value)) {
		if (!isObject(answers)) {
			continue;
		}
		const normalizedAnswers: Record<string, string> = {};
		for (const [fieldId, answer] of Object.entries(answers)) {
			if (typeof answer === "string") {
				normalizedAnswers[fieldId] = answer;
			}
		}
		if (Object.keys(normalizedAnswers).length > 0) {
			result[requestId] = normalizedAnswers;
		}
	}
	return result;
}

function isComposerContextItem(value: unknown): value is ComposerContextItem {
	return (
		isObject(value) &&
		(value.type === "file" ||
			value.type === "directory" ||
			value.type === "workspace" ||
			value.type === "skill" ||
			value.type === "terminal") &&
		typeof value.label === "string" &&
		typeof value.path === "string"
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
