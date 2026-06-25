import { describe, expect, it, vi } from "vitest";
import { ConversationRepository } from "../repository";

describe("ConversationRepository", () => {
	it("keeps setTurnRunning as a monotonic transition", () => {
		const run = vi.fn((_input?: unknown) => ({ changes: 0 }));
		let sql = "";
		const db = {
			prepare: vi.fn((statement: string) => {
				sql = statement;
				return { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		const result = repo.setTurnRunning({
			turnId: "turn-1",
			providerTurnId: "provider-turn-late",
			now: "2026-06-25T00:00:02.000Z",
		});

		expect(result).toBeUndefined();
		expect(sql).toContain("status IN ('queued', 'running', 'waiting_approval')");
		expect(run).toHaveBeenCalledWith({
			turnId: "turn-1",
			providerTurnId: "provider-turn-late",
			now: "2026-06-25T00:00:02.000Z",
		});
	});

	it("does not apply message or admitted side effects when terminal completion loses", () => {
		const statements: string[] = [];
		const run = vi.fn((_input?: unknown) => ({ changes: 0 }));
		const get = vi.fn(() => turnRow({ status: "completed" }));
		const db = {
			prepare: vi.fn((statement: string) => {
				statements.push(statement);
				return statement.startsWith("SELECT") ? { get } : { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		const result = repo.completeTurn({
			turnId: "turn-1",
			raw: { type: "final_answer" },
			status: "completed",
			now: "2026-06-25T00:00:02.000Z",
		});

		expect(result).toBeUndefined();
		expect(statements.join("\n")).toContain(
			"status IN ('queued', 'running', 'waiting_approval')",
		);
		expect(statements.join("\n")).not.toContain("UPDATE messages");
		expect(statements.join("\n")).not.toContain("UPDATE admitted_requests");
	});

	it("projects accepted terminal turn status to admitted requests", () => {
		const statements: string[] = [];
		const run = vi.fn((_input?: unknown) => ({ changes: 1 }));
		const get = vi.fn(() => turnRow({ status: "running" }));
		const db = {
			prepare: vi.fn((statement: string) => {
				statements.push(statement);
				return statement.startsWith("SELECT") ? { get } : { run };
			}),
		};
		const repo = new ConversationRepository(db as never);

		repo.completeTurn({
			turnId: "turn-1",
			raw: { type: "final_answer" },
			status: "completed",
			now: "2026-06-25T00:00:02.000Z",
		});

		const admittedCall = run.mock.calls.find(
			([input]) =>
				typeof input === "object" &&
				input !== null &&
				"turnId" in input &&
				"status" in input &&
				(input as { status?: unknown }).status === "completed",
		);
		expect(statements.join("\n")).toContain("UPDATE admitted_requests");
		expect(statements.join("\n")).toContain(
			"status NOT IN ('completed', 'failed', 'canceled')",
		);
		expect(admittedCall?.[0]).toEqual({
			turnId: "turn-1",
			status: "completed",
			error: null,
			now: "2026-06-25T00:00:02.000Z",
		});
	});

	it("projects interrupted turns to canceled admitted requests", () => {
		const run = vi.fn((_input?: unknown) => ({ changes: 1 }));
		const get = vi.fn(() => turnRow({ status: "running" }));
		const db = {
			prepare: vi.fn((statement: string) =>
				statement.startsWith("SELECT") ? { get } : { run },
			),
		};
		const repo = new ConversationRepository(db as never);

		repo.interruptTurn({
			turnId: "turn-1",
			message: "Interrupted",
			now: "2026-06-25T00:00:02.000Z",
		});

		const admittedCall = run.mock.calls.find(
			([input]) =>
				typeof input === "object" &&
				input !== null &&
				"turnId" in input &&
				"status" in input &&
				(input as { status?: unknown }).status === "canceled",
		);
		expect(admittedCall?.[0]).toEqual({
			turnId: "turn-1",
			status: "canceled",
			error: JSON.stringify({ message: "Interrupted" }),
			now: "2026-06-25T00:00:02.000Z",
		});
	});
});

function turnRow(input: { status: "running" | "completed" }) {
	return {
		id: "turn-1",
		conversation_id: "conversation-1",
		provider_session_id: "provider-session-1",
		provider_turn_id: null,
		user_message_id: "message-user-1",
		assistant_message_id: "message-assistant-1",
		status: input.status,
		started_at: "2026-06-25T00:00:00.000Z",
		completed_at:
			input.status === "completed" ? "2026-06-25T00:00:01.000Z" : null,
	};
}
