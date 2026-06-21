import type { FreshOpenAiAuth } from "./sidecar-openai";

const CODEX_API_ENDPOINT = "https://chatgpt.com/backend-api/codex/responses";
const ERROR_BODY_LIMIT = 1200;

export type CodexRequest = {
	model: string;
	instructions: string;
	input: unknown[];
	store: false;
	stream: true;
};

export type CodexResult = {
	output_text?: string;
	text?: string;
	raw?: unknown;
};

export class SidecarHttpError extends Error {
	constructor(
		public status: number,
		message: string,
	) {
		super(message);
	}
}

export async function proxyCodexResponses(input: {
	auth: FreshOpenAiAuth;
	body: unknown;
}) {
	const request = validateCodexRequest(input.body);
	const headers = new Headers({
		authorization: `Bearer ${input.auth.access}`,
		"content-type": "application/json",
		originator: "opencode",
		"user-agent": "experimental-desktop",
	});
	if (input.auth.accountId) {
		headers.set("ChatGPT-Account-Id", input.auth.accountId);
	}

	const response = await fetch(CODEX_API_ENDPOINT, {
		method: "POST",
		headers,
		body: JSON.stringify(request),
	});
	const responseBody = await response.text();
	if (!response.ok) {
		throw new SidecarHttpError(
			response.status,
			`Codex request failed: ${response.status} ${response.statusText}${formatErrorBody(responseBody)}`,
		);
	}

	return parseCodexResponse(responseBody);
}

export function validateCodexRequest(value: unknown): CodexRequest {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(400, "Codex request body must be an object");
	}
	const body = value as Record<string, unknown>;
	if (typeof body.model !== "string" || !body.model.trim()) {
		throw new SidecarHttpError(400, "Codex request model is required");
	}
	if (typeof body.instructions !== "string" || !body.instructions.trim()) {
		throw new SidecarHttpError(
			400,
			"Codex request instructions are required",
		);
	}
	if (!Array.isArray(body.input)) {
		throw new SidecarHttpError(400, "Codex request input must be a list");
	}
	if (body.store !== false) {
		throw new SidecarHttpError(400, "Codex request store must be false");
	}
	if (body.stream !== true) {
		throw new SidecarHttpError(400, "Codex request stream must be true");
	}
	return {
		...body,
		model: body.model,
		instructions: body.instructions,
		input: body.input,
		store: false,
		stream: true,
	};
}

export function parseCodexResponse(value: string): CodexResult | unknown {
	if (!value) {
		return null;
	}
	if (value.includes("\nevent:") || value.startsWith("event:")) {
		return parseServerSentEvents(value);
	}
	try {
		return JSON.parse(value) as unknown;
	} catch {
		return { text: value };
	}
}

function parseServerSentEvents(value: string): CodexResult {
	let outputText = "";
	for (const line of value.split("\n")) {
		if (!line.startsWith("data: ")) {
			continue;
		}
		const data = line.slice("data: ".length);
		if (!data || data === "[DONE]") {
			continue;
		}
		try {
			const event = JSON.parse(data) as Record<string, unknown>;
			if (
				event.type === "response.output_text.delta" &&
				typeof event.delta === "string"
			) {
				outputText += event.delta;
			}
			if (
				event.type === "response.output_text.done" &&
				typeof event.text === "string"
			) {
				outputText = event.text;
			}
		} catch {
			// Ignore non-JSON SSE keepalives.
		}
	}
	return outputText ? { output_text: outputText } : { text: value };
}

function formatErrorBody(value: string) {
	if (!value) {
		return "";
	}
	const redacted = redact(value);
	const capped =
		redacted.length > ERROR_BODY_LIMIT
			? `${redacted.slice(0, ERROR_BODY_LIMIT)}...`
			: redacted;
	return `: ${capped}`;
}

function redact(value: string) {
	return value
		.replaceAll(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
		.replaceAll(
			/"access_token"\s*:\s*"[^"]+"/g,
			'"access_token":"[redacted]"',
		)
		.replaceAll(
			/"refresh_token"\s*:\s*"[^"]+"/g,
			'"refresh_token":"[redacted]"',
		);
}
