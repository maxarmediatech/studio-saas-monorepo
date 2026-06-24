import { describe, expect, it } from "vitest";
import { buildComposerPayload } from "../../composerPayload";
import { buildComposerRequestParts } from "../composerRequestParts";

describe("buildComposerRequestParts", () => {
	it("preserves payload order for context, attachments, and text", () => {
		const parts = buildComposerRequestParts(
			buildComposerPayload({
				mode: "ask",
				text: " Explain this ",
				contextItems: [
					{
						type: "workspace",
						label: "repo",
						path: "/repo",
						folderMode: "tree",
					},
					{ type: "file", label: "index.ts", path: "/repo/index.ts" },
				],
				attachments: [
					{
						id: "image-1",
						kind: "image",
						name: "shot.png",
						path: "/tmp/shot.png",
						mimeType: "image/png",
						status: "ready",
					},
					{
						id: "file-1",
						kind: "file",
						name: "notes.md",
						path: "/tmp/notes.md",
						mimeType: "text/markdown",
						status: "ready",
					},
				],
			}),
		);

		expect(parts).toEqual([
			{
				type: "folder_ref",
				path: "/repo",
				label: "repo",
				mode: "tree",
			},
			{
				type: "context_ref",
				path: "/repo/index.ts",
				label: "index.ts",
				contextType: "file",
			},
			{
				type: "image_ref",
				path: "/tmp/shot.png",
				name: "shot.png",
				mimeType: "image/png",
			},
			{
				type: "file_ref",
				path: "/tmp/notes.md",
				name: "notes.md",
				mimeType: "text/markdown",
			},
			{ type: "text", text: "Explain this" },
		]);
	});

	it("dedupes repeated file/context references while keeping distinct modes", () => {
		const parts = buildComposerRequestParts(
			buildComposerPayload({
				mode: "ask",
				text: "Compare",
				contextItems: [
					{ type: "file", label: "a.ts", path: "/repo/a.ts" },
					{ type: "file", label: "a copy", path: "/repo/a.ts" },
					{
						type: "directory",
						label: "repo tree",
						path: "/repo",
						folderMode: "tree",
					},
					{
						type: "directory",
						label: "repo summary",
						path: "/repo",
						folderMode: "summary",
					},
				],
				attachments: [
					{
						id: "file-1",
						kind: "file",
						name: "a.ts",
						path: "/repo/a.ts",
						mimeType: "text/typescript",
						status: "ready",
					},
					{
						id: "file-2",
						kind: "file",
						name: "a-again.ts",
						path: "/repo/a.ts",
						mimeType: "text/typescript",
						status: "ready",
					},
				],
			}),
		);

		expect(parts).toEqual([
			expect.objectContaining({
				type: "context_ref",
				path: "/repo/a.ts",
				label: "a.ts",
			}),
			expect.objectContaining({
				type: "folder_ref",
				path: "/repo",
				mode: "tree",
			}),
			expect.objectContaining({
				type: "folder_ref",
				path: "/repo",
				mode: "summary",
			}),
			expect.objectContaining({
				type: "file_ref",
				path: "/repo/a.ts",
				name: "a.ts",
			}),
			{ type: "text", text: "Compare" },
		]);
	});
});
