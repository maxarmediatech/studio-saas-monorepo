import { randomUUID } from "node:crypto";
import { SidecarHttpError } from "./sidecar-codex";
import type {
	CodexRuntimeEvent,
	CodexRuntimeMode,
	CodexSessionRuntime,
} from "./sidecar-codex-runtime";

export type SessionEvent =
	| {
			id: string;
			type: "message.created";
			time: string;
			data: { text: string };
	  }
	| {
			id: string;
			type: "assistant.delta";
			time: string;
			data: { text?: string; turnId?: string; raw: unknown };
	  }
	| {
			id: string;
			type: "assistant.completed";
			time: string;
			data: { turnId?: string; raw: unknown };
	  }
	| {
			id: string;
			type: "message.failed";
			time: string;
			data: { error: string; turnId?: string; raw?: unknown };
	  }
	| {
			id: string;
			type: "request.pending";
			time: string;
			data: {
				requestId: string;
				method: string;
				requestKind:
					| "command"
					| "file-change"
					| "user-input"
					| "unknown";
				turnId?: string;
				itemId?: string;
				raw: unknown;
			};
	  }
	| {
			id: string;
			type: "request.resolved";
			time: string;
			data: { requestId: string; response: unknown };
	  }
	| {
			id: string;
			type: "provider.raw";
			time: string;
			data: { method: string; params: unknown };
	  };

type Session = {
	id: string;
	threadId: string;
	cwd: string;
	runtimeMode: CodexRuntimeMode;
	createdAt: string;
	events: SessionEvent[];
	subscribers: Set<(event: SessionEvent) => void>;
	completedTurnIds: Set<string>;
	activeTurnId?: string;
};

export function createSessionController(input: {
	runtime: CodexSessionRuntime;
}) {
	const sessions = new Map<string, Session>();
	const sessionsByThreadId = new Map<string, Session>();
	const sessionsByTurnId = new Map<string, Session>();
	const sessionsByRequestId = new Map<string, Session>();
	const unsubscribeRuntime = input.runtime.subscribe((event) => {
		handleRuntimeEvent(event);
	});

	async function create(body?: unknown) {
		const options = validateCreateSession(body);
		const cwd = options.cwd ?? process.cwd();
		await input.runtime.ensure();
		const thread = await input.runtime.createThread({ ...options, cwd });
		const session: Session = {
			id: randomUUID(),
			threadId: thread.threadId,
			cwd,
			runtimeMode: options.runtimeMode,
			createdAt: new Date().toISOString(),
			events: [],
			subscribers: new Set(),
			completedTurnIds: new Set(),
		};
		sessions.set(session.id, session);
		sessionsByThreadId.set(session.threadId, session);
		return {
			id: session.id,
			threadId: session.threadId,
			createdAt: session.createdAt,
		};
	}

	async function sendMessage(sessionId: string, body: unknown) {
		const session = getSession(sessionId);
		if (session.activeTurnId) {
			throw new SidecarHttpError(
				409,
				"Session already has a running turn",
			);
		}
		const message = validateMessage(body);
		pushEvent(session, "message.created", { text: message.text });
		try {
			const turn = await input.runtime.sendTurn({
				threadId: session.threadId,
				text: message.text,
				cwd: session.cwd,
				model: message.model,
				runtimeMode: session.runtimeMode,
			});
			if (turn.turnId) {
				sessionsByTurnId.set(turn.turnId, session);
			}
			if (!turn.turnId || !session.completedTurnIds.has(turn.turnId)) {
				session.activeTurnId = turn.turnId;
			}
			return { accepted: true, turnId: turn.turnId };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			pushEvent(session, "message.failed", { error: message });
			throw error;
		}
	}

	function events(sessionId: string) {
		const session = getSession(sessionId);
		return {
			id: session.id,
			threadId: session.threadId,
			events: session.events,
		};
	}

	async function respondToRequest(
		sessionId: string,
		requestId: string,
		body: unknown,
	) {
		const session = getSession(sessionId);
		if (sessionsByRequestId.get(requestId)?.id !== session.id) {
			throw new SidecarHttpError(404, "Pending request not found");
		}
		const response = validateRequestResponse(body);
		await input.runtime.respondToRequest({ requestId, response });
		sessionsByRequestId.delete(requestId);
		pushEvent(session, "request.resolved", { requestId, response });
		return { ok: true };
	}

	function subscribe(
		sessionId: string,
		listener: (event: SessionEvent) => void,
	) {
		const session = getSession(sessionId);
		for (const event of session.events) {
			listener(event);
		}
		session.subscribers.add(listener);
		return () => {
			session.subscribers.delete(listener);
		};
	}

	function stop() {
		unsubscribeRuntime();
		sessions.clear();
		sessionsByThreadId.clear();
		sessionsByTurnId.clear();
		sessionsByRequestId.clear();
	}

	function handleRuntimeEvent(event: CodexRuntimeEvent) {
		const threadId = readThreadId(event.params);
		const turnId = readTurnId(event.params);
		const session =
			(threadId ? sessionsByThreadId.get(threadId) : undefined) ??
			(turnId ? sessionsByTurnId.get(turnId) : undefined);
		if (!session) {
			return;
		}
		if (event.kind === "request") {
			sessionsByRequestId.set(event.requestId, session);
			pushEvent(session, "request.pending", {
				requestId: event.requestId,
				method: event.method,
				requestKind: readRequestKind(event.method),
				turnId,
				itemId: readItemId(event.params),
				raw: event.params,
			});
			return;
		}
		if (event.method === "item/agentMessage/delta") {
			pushEvent(session, "assistant.delta", {
				text: readDeltaText(event.params),
				turnId,
				raw: event.params,
			});
			return;
		}
		if (event.method === "turn/completed") {
			if (turnId) {
				session.completedTurnIds.add(turnId);
				sessionsByTurnId.delete(turnId);
			}
			if (isFailedTurn(event.params)) {
				pushEvent(session, "message.failed", {
					error: readTurnError(event.params),
					turnId,
					raw: event.params,
				});
			} else {
				pushEvent(session, "assistant.completed", {
					turnId,
					raw: event.params,
				});
			}
			if (
				!turnId ||
				!session.activeTurnId ||
				session.activeTurnId === turnId
			) {
				session.activeTurnId = undefined;
			}
			return;
		}
		if (event.method === "error") {
			pushEvent(session, "message.failed", {
				error: readErrorMessage(event.params),
				turnId,
				raw: event.params,
			});
			if (!turnId || session.activeTurnId === turnId) {
				session.activeTurnId = undefined;
			}
			return;
		}
		pushEvent(session, "provider.raw", {
			method: event.method,
			params: event.params,
		});
	}

	function getSession(sessionId: string) {
		const session = sessions.get(sessionId);
		if (!session) {
			throw new SidecarHttpError(404, "Session not found");
		}
		return session;
	}

	return { create, sendMessage, events, respondToRequest, subscribe, stop };
}

function validateCreateSession(value: unknown): {
	cwd?: string;
	model?: string;
	runtimeMode: CodexRuntimeMode;
} {
	if (value === null || value === undefined) {
		return { runtimeMode: "read-only" };
	}
	if (typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(400, "Session body must be an object");
	}
	const body = value as Record<string, unknown>;
	return {
		...(typeof body.cwd === "string" && body.cwd.trim()
			? { cwd: body.cwd }
			: {}),
		...(typeof body.model === "string" && body.model.trim()
			? { model: body.model }
			: {}),
		runtimeMode: validateRuntimeMode(body.runtimeMode),
	};
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

function validateMessage(value: unknown): {
	text: string;
	model?: string;
} {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(
			400,
			"Session message body must be an object",
		);
	}
	const body = value as Record<string, unknown>;
	if (typeof body.text !== "string" || !body.text.trim()) {
		throw new SidecarHttpError(400, "Session message text is required");
	}
	return {
		text: body.text,
		...(typeof body.model === "string" && body.model.trim()
			? { model: body.model }
			: {}),
	};
}

function validateRequestResponse(value: unknown) {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(
			400,
			"Request response body must be an object",
		);
	}
	const body = value as Record<string, unknown>;
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
	throw new SidecarHttpError(
		400,
		"Request response must include decision or answers",
	);
}

function pushEvent(
	session: Session,
	type: SessionEvent["type"],
	data: SessionEvent["data"],
) {
	const event = {
		id: randomUUID(),
		type,
		time: new Date().toISOString(),
		data,
	} as SessionEvent;
	session.events.push(event);
	for (const subscriber of session.subscribers) {
		subscriber(event);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === "object" && !Array.isArray(value);
}

function readThreadId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	if (typeof value.threadId === "string") {
		return value.threadId;
	}
	const thread = value.thread;
	if (isRecord(thread) && typeof thread.id === "string") {
		return thread.id;
	}
	return undefined;
}

function readTurnId(value: unknown) {
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

function readItemId(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	return typeof value.itemId === "string" ? value.itemId : undefined;
}

function readRequestKind(method: string) {
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

function readDeltaText(value: unknown) {
	if (!isRecord(value)) {
		return undefined;
	}
	return typeof value.delta === "string" ? value.delta : undefined;
}

function isFailedTurn(value: unknown) {
	if (!isRecord(value) || !isRecord(value.turn)) {
		return false;
	}
	return value.turn.status === "failed";
}

function readTurnError(value: unknown) {
	if (!isRecord(value) || !isRecord(value.turn)) {
		return "Codex turn failed";
	}
	const error = value.turn.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex turn failed";
}

function readErrorMessage(value: unknown) {
	if (!isRecord(value)) {
		return "Codex app-server error";
	}
	const error = value.error;
	if (isRecord(error) && typeof error.message === "string") {
		return error.message;
	}
	return "Codex app-server error";
}
