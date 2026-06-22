import {
	type CodexResult,
	callSimpleCompletion,
	SidecarHttpError,
	type SimpleCompletionRequest,
} from "./sidecar-codex";
import type { FreshOpenAiAuth } from "./sidecar-openai";

export async function generateConversationSummary(input: {
	auth: FreshOpenAiAuth;
	body: unknown;
}) {
	const result = await callSimpleCompletion(
		input.auth,
		parseSummaryBody(input.body),
	);
	const summary = readSummaryText(result);
	if (!summary) {
		throw new SidecarHttpError(
			502,
			"Summary response did not include text",
		);
	}
	return { summary };
}

function parseSummaryBody(value: unknown): SimpleCompletionRequest {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(
			400,
			"Summary request body must be an object",
		);
	}
	const body = value as Record<string, unknown>;
	if (typeof body.model !== "string" || !body.model.trim()) {
		throw new SidecarHttpError(400, "Summary request model is required");
	}
	if (typeof body.instructions !== "string" || !body.instructions.trim()) {
		throw new SidecarHttpError(
			400,
			"Summary request instructions are required",
		);
	}
	if (!Array.isArray(body.input)) {
		throw new SidecarHttpError(400, "Summary request input must be a list");
	}
	if (
		typeof body.max_output_tokens !== "number" ||
		!Number.isInteger(body.max_output_tokens) ||
		body.max_output_tokens <= 0
	) {
		throw new SidecarHttpError(
			400,
			"Summary request max_output_tokens must be a positive integer",
		);
	}
	return {
		model: body.model,
		instructions: body.instructions,
		input: body.input.map(parseSummaryInputItem),
		max_output_tokens: body.max_output_tokens,
	};
}

function parseSummaryInputItem(
	value: unknown,
): SimpleCompletionRequest["input"][number] {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new SidecarHttpError(400, "Summary input item must be an object");
	}
	const item = value as Record<string, unknown>;
	if (item.role !== "user" && item.role !== "system") {
		throw new SidecarHttpError(
			400,
			"Summary input item role must be user or system",
		);
	}
	if (typeof item.content !== "string") {
		throw new SidecarHttpError(
			400,
			"Summary input item content must be a string",
		);
	}
	return {
		role: item.role,
		content: item.content,
	};
}

function readSummaryText(value: unknown) {
	if (!value || typeof value !== "object") {
		return "";
	}
	const result = value as CodexResult;
	return (result.output_text ?? result.text ?? "").trim();
}
