import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { openConversationDatabase } from "../../storage/database";
import { createConversationController } from "../controller";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		rmSync(dir, { recursive: true, force: true });
	}
});

describe("ConversationController", () => {
	it("rejects legacy draft promotion before route drafts can be half-promoted", async () => {
		const db = openConversationDatabase(tempDbPath());
		const controller = createConversationController({
			db,
			sidecarManager: {
				ensure: vi.fn(async () => ({
					url: "http://127.0.0.1:1",
					username: "test",
					password: "test",
					stop: async () => undefined,
				})),
				fetch: vi.fn(async () => ({})),
				stop: vi.fn(async () => undefined),
			},
		});
		const draftId = "550e8400-e29b-41d4-a716-446655440030";
		const now = "2026-06-26T00:00:00.000Z";
		db.prepare(
			`INSERT INTO drafts
			(id, text, cwd, model, runtime_mode, attachments_json, payload_json, status, created_at, updated_at)
			VALUES (@id, 'Ship it', '/workspace', NULL, 'read-only', '[]', '{}', 'active', @now, @now)`,
		).run({ id: draftId, now });

		await expect(
			controller.promoteDraftAndSend({
				draftId,
				text: "Ship it",
				cwd: "/workspace",
				runtimeMode: "read-only",
			}),
		).rejects.toThrow("Legacy draft promotion does not accept draft ids");

		const draft = db
			.prepare(
				`SELECT status, promoted_conversation_id AS promotedConversationId
				FROM drafts
				WHERE id = ?`,
			)
			.get(draftId) as {
			status: string;
			promotedConversationId: string | null;
		};
		const conversationCount = db
			.prepare("SELECT COUNT(*) AS count FROM conversations")
			.get() as { count: number };
		expect(draft).toEqual({
			status: "active",
			promotedConversationId: null,
		});
		expect(conversationCount.count).toBe(0);
		await controller.stop();
		db.close();
	});
});

function tempDbPath() {
	const dir = mkdtempSync(join(tmpdir(), "experimental-desktop-controller-"));
	tempDirs.push(dir);
	return join(dir, "conversations.sqlite");
}
