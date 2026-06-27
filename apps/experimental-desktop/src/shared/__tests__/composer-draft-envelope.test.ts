import { describe, expect, it } from "vitest";
import {
	normalizeComposerDraftEnvelope,
	rebuildComposerDraftEnvelopeFromLegacy,
} from "../composer-draft-envelope";
import {
	draftIdForComposerTarget,
	parseComposerTarget,
} from "../composer-target";

describe("composer draft shared parsing", () => {
	it("rejects reserved route draft ids", () => {
		expect(() =>
			parseComposerTarget({
				kind: "draft",
				id: "composer:conversation:550e8400-e29b-41d4-a716-446655440000",
			}),
		).toThrow("reserved internal prefix");
	});

	it("keeps route draft ids exact and namespaces conversation drafts", () => {
		const draft = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440000",
		});
		const conversation = parseComposerTarget({
			kind: "conversation",
			id: "550e8400-e29b-41d4-a716-446655440001",
		});

		expect(draftIdForComposerTarget(draft)).toBe(
			"550e8400-e29b-41d4-a716-446655440000",
		);
		expect(draftIdForComposerTarget(conversation)).toBe(
			"composer:conversation:550e8400-e29b-41d4-a716-446655440001",
		);
	});

	it("strips non-durable attachment preview URLs from envelopes", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440000",
		});
		const parsed = normalizeComposerDraftEnvelope({
			target,
			updatedAt: "2026-06-26T00:00:00.000Z",
			envelope: {
				version: 2,
				target,
				input: {
					text: "hello",
					mode: "ask",
					model: "gpt-5.4-mini",
					runtimeMode: "workspace-write",
					contextItems: [],
					attachments: [
						{
							id: "attachment-1",
							kind: "image",
							name: "shot.png",
							path: "/tmp/shot.png",
							mimeType: "image/png",
							previewUrl: "blob:stale",
							status: "ready",
						},
					],
					payload: {},
				},
				pendingRequestAnswerDrafts: {},
				updatedAt: "2026-06-26T00:00:00.000Z",
			},
		});

		expect(parsed.envelope.input.attachments[0]).toEqual({
			id: "attachment-1",
			kind: "image",
			name: "shot.png",
			path: "/tmp/shot.png",
			mimeType: "image/png",
			status: "ready",
		});
	});

	it("normalizes context paths and clamps persisted selection", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440006",
		});
		const parsed = normalizeComposerDraftEnvelope({
			target,
			updatedAt: "2026-06-26T00:00:00.000Z",
			envelope: {
				version: 2,
				target,
				input: {
					text: "hello",
					mode: "ask",
					model: "gpt-5.4-mini",
					runtimeMode: "workspace-write",
					contextItems: [
						{
							type: "file",
							label: "index.ts",
							path: "\\repo//src/./index.ts",
						},
					],
					attachments: [],
					selection: { start: 99, end: 2 },
					payload: {},
				},
				pendingRequestAnswerDrafts: {},
				updatedAt: "2026-06-26T00:00:00.000Z",
			},
		});

		expect(parsed.envelope.input.contextItems[0]?.path).toBe(
			"/repo/src/index.ts",
		);
		expect(parsed.envelope.input.selection).toEqual({ start: 2, end: 5 });
	});

	it("drops ready pathless attachments but preserves failed diagnostics", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440007",
		});
		const parsed = normalizeComposerDraftEnvelope({
			target,
			updatedAt: "2026-06-26T00:00:00.000Z",
			envelope: {
				version: 2,
				target,
				input: {
					text: "hello",
					mode: "ask",
					model: "gpt-5.4-mini",
					runtimeMode: "workspace-write",
					contextItems: [],
					attachments: [
						{
							id: "ready-missing-path",
							kind: "file",
							name: "missing.txt",
							status: "ready",
						},
						{
							id: "failed-diagnostic",
							kind: "file",
							name: "missing.txt",
							status: "failed",
							error: "No longer available",
						},
					],
					payload: {},
				},
				pendingRequestAnswerDrafts: {},
				updatedAt: "2026-06-26T00:00:00.000Z",
			},
		});

		expect(parsed.envelope.input.attachments).toEqual([
			{
				id: "failed-diagnostic",
				kind: "file",
				name: "missing.txt",
				status: "failed",
				error: "No longer available",
			},
		]);
		expect(parsed.warnings).toContain("draft_parse_invalid_attachment");
	});

	it("rebuilds legacy draft rows without blanking saved input", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440002",
		});
		const parsed = rebuildComposerDraftEnvelopeFromLegacy({
			id: "550e8400-e29b-41d4-a716-446655440002",
			target,
			text: "legacy text",
			model: "gpt-5.4-mini",
			runtimeMode: "workspace-write",
			attachments: [
				{
					id: "attachment-legacy",
					kind: "file",
					name: "notes.md",
					path: "/tmp/notes.md",
					mimeType: "text/markdown",
					status: "ready",
				},
			],
			payload: {
				mode: "build",
				contextItems: [
					{
						id: "ctx-1",
						label: "src/index.ts",
						path: "/repo/src/index.ts",
						type: "file",
					},
				],
			},
			updatedAt: "2026-06-26T00:00:00.000Z",
		});

		expect(parsed.envelope.input.text).toBe("legacy text");
		expect(parsed.envelope.input.model).toBe("gpt-5.4-mini");
		expect(parsed.envelope.input.runtimeMode).toBe("workspace-write");
		expect(parsed.envelope.input.mode).toBe("build");
		expect(parsed.envelope.input.attachments).toHaveLength(1);
		expect(parsed.envelope.input.contextItems).toHaveLength(1);
		expect(parsed.warnings).toContain("draft_parse_rebuilt_legacy_payload");
	});

	it("returns an empty recoverable envelope for unknown versions", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440004",
		});
		const parsed = normalizeComposerDraftEnvelope({
			target,
			updatedAt: "2026-06-26T00:00:00.000Z",
			envelope: {
				version: 99,
				target,
				input: { text: "do not trust" },
			},
		});

		expect(parsed.envelope.input.text).toBe("");
		expect(parsed.warnings).toContain("draft_parse_unknown_version");
	});

	it("drops malformed attachments but preserves valid old attachment rows", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440005",
		});
		const parsed = rebuildComposerDraftEnvelopeFromLegacy({
			id: target.id,
			target,
			text: "old row with attachments",
			runtimeMode: "read-only",
			attachments: [
				{ id: "missing-kind", name: "broken.txt" },
				{
					id: "valid-file",
					kind: "file",
					name: "notes.md",
					path: "/tmp/notes.md",
					mimeType: "text/markdown",
					previewUrl: "blob:old",
					status: "ready",
				},
			],
			payload: {},
			updatedAt: "2026-06-26T00:00:00.000Z",
		});

		expect(parsed.envelope.input.attachments).toEqual([
			{
				id: "valid-file",
				kind: "file",
				name: "notes.md",
				path: "/tmp/notes.md",
				mimeType: "text/markdown",
				status: "ready",
			},
		]);
		expect(parsed.warnings).toContain("draft_parse_invalid_attachment");
	});

	it("restores model and runtime mode from v2 envelopes", () => {
		const target = parseComposerTarget({
			kind: "draft",
			id: "550e8400-e29b-41d4-a716-446655440003",
		});
		const parsed = normalizeComposerDraftEnvelope({
			target,
			updatedAt: "2026-06-26T00:00:00.000Z",
			envelope: {
				version: 2,
				target,
				input: {
					text: "restore me",
					mode: "review",
					model: "gpt-5.5-thinking",
					runtimeMode: "full-access",
					contextItems: [],
					attachments: [],
					payload: {},
				},
				pendingRequestAnswerDrafts: {},
				updatedAt: "2026-06-26T00:00:00.000Z",
			},
		});

		expect(parsed.envelope.input.model).toBe("gpt-5.5-thinking");
		expect(parsed.envelope.input.runtimeMode).toBe("full-access");
		expect(parsed.envelope.input.mode).toBe("review");
	});
});
