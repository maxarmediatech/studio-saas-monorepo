import { randomUUID } from "node:crypto";
import {
	type CodexResult,
	proxyCodexResponses,
	SidecarHttpError,
} from "./sidecar-codex";
import type { FreshOpenAiAuth } from "./sidecar-openai";

type SessionEvent = {
	id: string;
	type: "message.created" | "message.completed" | "message.failed";
	time: string;
	data: unknown;
};

type Session = {
	id: string;
	createdAt: string;
	events: SessionEvent[];
	subscribers: Set<(event: SessionEvent) => void>;
};

const DEFAULT_MODELS = [
	"gpt-5.5",
	"gpt-5.4",
	"gpt-5.4-mini",
	"gpt-5.3-codex-spark",
];

export function createSessionController(input: {
	getFreshAuth: () => Promise<FreshOpenAiAuth>;
}) {
	const sessions = new Map<string, Session>();

	function create() {
		const session: Session = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			events: [],
			subscribers: new Set(),
		};
		sessions.set(session.id, session);
		return { id: session.id, createdAt: session.createdAt };
	}

	async function sendMessage(sessionId: string, body: unknown) {
		const session = sessions.get(sessionId);
		if (!session) {
			throw new SidecarHttpError(404, "Session not found");
		}
		const message = validateMessage(body);
		pushEvent(session, "message.created", { text: message.text });
		try {
			// Dev fallback while the Codex app-server session runtime is being wired.
			const result = await sendWithModelFallback({
				auth: await input.getFreshAuth(),
				text: message.text,
				models: message.models ?? DEFAULT_MODELS,
			});
			pushEvent(session, "message.completed", result);
			return result;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			pushEvent(session, "message.failed", { error: message });
			throw error;
		}
	}

	function events(sessionId: string) {
		const session = sessions.get(sessionId);
		if (!session) {
			throw new SidecarHttpError(404, "Session not found");
		}
		return { id: session.id, events: session.events };
	}

	function subscribe(
		sessionId: string,
		listener: (event: SessionEvent) => void,
	) {
		const session = sessions.get(sessionId);
		if (!session) {
			throw new SidecarHttpError(404, "Session not found");
		}
		for (const event of session.events) {
			listener(event);
		}
		session.subscribers.add(listener);
		return () => {
			session.subscribers.delete(listener);
		};
	}

	return { create, sendMessage, events, subscribe };
}

export async function sendWithModelFallback(input: {
	auth: FreshOpenAiAuth;
	text: string;
	models?: string[];
}): Promise<CodexResult | unknown> {
	const errors: string[] = [];
	for (const model of input.models ?? DEFAULT_MODELS) {
		try {
			return await proxyCodexResponses({
				auth: input.auth,
				body: createCodexMessageBody(model, input.text),
			});
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			errors.push(`${model}: ${message}`);
			if (!message.includes("model is not supported")) {
				throw error;
			}
		}
	}
	throw new SidecarHttpError(
		400,
		`No tested Codex model was accepted by this ChatGPT account. ${errors.join(" | ")}`,
	);
}

function createCodexMessageBody(model: string, text: string) {
	return {
		model,
		instructions:
			"You are a concise smoke-test assistant. Confirm whether the Codex proxy works.",
		input: [
			{
				role: "user",
				content: [{ type: "input_text", text }],
			},
		],
		store: false,
		stream: true,
	};
}

function validateMessage(value: unknown): {
	text: string;
	models?: string[];
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
	if (body.models !== undefined) {
		if (
			!Array.isArray(body.models) ||
			body.models.some((model) => typeof model !== "string")
		) {
			throw new SidecarHttpError(
				400,
				"Session message models must be a string list",
			);
		}
		return { text: body.text, models: body.models as string[] };
	}
	return { text: body.text };
}

function pushEvent(
	session: Session,
	type: SessionEvent["type"],
	data: unknown,
) {
	const event = {
		id: randomUUID(),
		type,
		time: new Date().toISOString(),
		data,
	} satisfies SessionEvent;
	session.events.push(event);
	for (const subscriber of session.subscribers) {
		subscriber(event);
	}
}
