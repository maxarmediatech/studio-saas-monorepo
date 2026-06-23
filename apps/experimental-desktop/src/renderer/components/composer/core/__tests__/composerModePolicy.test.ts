import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../composerPayload";
import { resolveComposerModePolicy } from "../composerModePolicy";
import { codexRuntimeCapabilities } from "../runtimeCapabilityMap";

function policyFor(input: {
	mode: "ask" | "plan" | "build" | "review" | "shell";
	runtimeMode: "read-only" | "workspace-write" | "full-access";
	text?: string;
}) {
	return resolveComposerModePolicy({
		payload: buildComposerPayload({
			mode: input.mode,
			text: input.text ?? "hello",
			contextItems: [],
			attachments: [],
		}),
		runtimeMode: input.runtimeMode,
		capabilities: codexRuntimeCapabilities,
	});
}

describe("resolveComposerModePolicy", () => {
	it.each([
		"ask",
		"plan",
		"review",
	] as const)("forces %s mode to read-only", (mode) => {
		const result = policyFor({ mode, runtimeMode: "workspace-write" });

		expect(result.ok).toBe(true);
		expect(result.runtimeMode).toBe("read-only");
		expect(result.warnings).toEqual([`${mode} mode runs read-only.`]);
	});

	it("keeps build mode on the selected runtime during P0", () => {
		const result = policyFor({
			mode: "build",
			runtimeMode: "read-only",
		});

		expect(result.ok).toBe(true);
		expect(result.runtimeMode).toBe("read-only");
	});

	it("warns when build mode uses explicit full access", () => {
		const result = policyFor({
			mode: "build",
			runtimeMode: "full-access",
		});

		expect(result.ok).toBe(true);
		expect(result.warnings).toEqual([
			"Build is using explicitly selected full access.",
		]);
	});

	it("blocks shell mode until Codex has a direct shell path", () => {
		const result = policyFor({
			mode: "shell",
			runtimeMode: "read-only",
			text: "pwd",
		});

		expect(result.ok).toBe(false);
		expect(result.blocks).toContain(
			"Shell mode is not supported by the selected provider yet.",
		);
	});
});
