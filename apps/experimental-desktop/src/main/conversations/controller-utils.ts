import type {
	CodexRuntimeEvent,
	CodexRuntimeMode,
} from "../sidecar-codex-runtime";
import type { ApprovalKind, ApprovalStatus } from "./types";

export function parseSseMessage(message: string) {
	const dataLine = message
		.split("\n")
		.find((line) => line.startsWith("data:"));
	if (!dataLine) {
		return undefined;
	}
	const data = dataLine.slice("data:".length).trim();
	if (!data || data === "{}") {
		return undefined;
	}
	return JSON.parse(data) as CodexRuntimeEvent;
}

export function validateDraftBody(value: unknown): {
	text?: string;
	cwd?: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
	attachments?: unknown[];
	payload?: unknown;
} {
	if (value === null || value === undefined) {
		return { runtimeMode: "read-only" };
	}
	const body = validateObject(value, "Draft body must be an object");
	return {
		...(typeof body.text === "string" ? { text: body.text } : {}),
		...(typeof body.cwd === "string" && body.cwd.trim()
			? { cwd: body.cwd }
			: {}),
		...(typeof body.model === "string" && body.model.trim()
			? { model: body.model }
			: {}),
		...(Array.isArray(body.attachments)
			? { attachments: body.attachments }
			: {}),
		...(body.payload !== undefined ? { payload: body.payload } : {}),
		runtimeMode: validateRuntimeMode(body.runtimeMode),
	};
}

export function validateSendBody(value: unknown): {
	draftId?: string;
	text: string;
	cwd?: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
	payload?: unknown;
} {
	const body = validateObject(value, "Message body must be an object");
	if (typeof body.text !== "string" || !body.text.trim()) {
		throw new Error("Message text is required");
	}
	return {
		...(typeof body.draftId === "string" && body.draftId.trim()
			? { draftId: body.draftId }
			: {}),
		text: body.text.trim(),
		...(typeof body.cwd === "string" && body.cwd.trim()
			? { cwd: body.cwd }
			: {}),
		...(typeof body.model === "string" && body.model.trim()
			? { model: body.model }
			: {}),
		...(body.payload !== undefined ? { payload: body.payload } : {}),
		runtimeMode: validateRuntimeMode(body.runtimeMode),
	};
}

export function validateObject(value: unknown, message: string) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error(message);
	}
	return value as Record<string, unknown>;
}

export function validateRequestResponse(value: unknown) {
	const body = validateObject(
		value,
		"Request response body must be an object",
	);
	if (body.decision === "accept" || body.decision === "acceptForSession") {
		return { decision: body.decision };
	}
	if (body.decision === "decline" || body.decision === "cancel") {
		return { decision: body.decision };
	}
	if (isRecord(body.answers)) {
		return {
			answers: Object.fromEntries(
				Object.entries(body.answers).map(([questionId, answer]) => [
					questionId,
					{
						answers: Array.isArray(answer)
							? answer.filter(
									(value): value is string =>
										typeof value === "string",
								)
							: typeof answer === "string"
								? [answer]
								: [],
					},
				]),
			),
		};
	}
	throw new Error("Request response must include decision or answers");
}

export function approvalStatusFromResponse(value: unknown): ApprovalStatus {
	if (!isRecord(value)) {
		return "failed";
	}
	if (value.decision === "accept") {
		return "accepted";
	}
	if (value.decision === "acceptForSession") {
		return "accepted_for_session";
	}
	if (value.decision === "decline") {
		return "declined";
	}
	if (value.decision === "cancel") {
		return "canceled";
	}
	if ("answers" in value) {
		return "accepted";
	}
	return "failed";
}

export function readTurnId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	if (typeof value.turnId === "string") {
		return value.turnId;
	}
	const turn = value.turn;
	if (isRecord(turn) && typeof turn.id === "string") {
		return turn.id;
	}
	return undefined;
}

export function readItemId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	return typeof value.itemId === "string" ? value.itemId : undefined;
}

export function readRequestKind(method: string): ApprovalKind {
	if (method === "item/commandExecution/requestApproval") {
		return "command";
	}
	if (method === "item/fileChange/requestApproval") {
		return "file-change";
	}
	if (method === "item/tool/requestUserInput") {
		return "user-input";
	}
	return "unknown";
}

export function readDeltaText(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	return typeof value.delta === "string" ? value.delta : undefined;
}

export function isFailedTurn(value: unknown) {
	return (
		isRecord(value) &&
		isRecord(value.turn) &&
		value.turn.status === "failed"
	);
}

export function readTurnError(value: unknown) {
	if (!isRecord(value) || !isRecord(value.turn)) {
		return "Codex turn failed";
	}
	const error = value.turn.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex turn failed";
}

export function readErrorMessage(value: unknown) {
	if (!isRecord(value)) {
		return "Codex app-server error";
	}
	const error = value.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex app-server error";
}

function validateRuntimeMode(value: unknown): CodexRuntimeMode {
	if (
		value === "read-only" ||
		value === "workspace-write" ||
		value === "full-access"
	) {
		return value;
	}
	return "read-only";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

export function now() {
	return new Date().toISOString();
}
