import {
	type CodexResult,
	proxyCodexResponses,
	SidecarHttpError,
} from "./sidecar-codex";
import type { FreshOpenAiAuth } from "./sidecar-openai";

export async function generateConversationSummary(input: {
	auth: FreshOpenAiAuth;
	body: unknown;
}) {
	const result = await proxyCodexResponses({
		auth: input.auth,
		body: input.body,
	});
	const summary = readSummaryText(result);
	if (!summary) {
		throw new SidecarHttpError(
			502,
			"Summary response did not include text",
		);
	}
	return { summary };
}

function readSummaryText(value: unknown) {
	if (!value || typeof value !== "object") {
		return "";
	}
	const result = value as CodexResult;
	return (result.output_text ?? result.text ?? "").trim();
}
