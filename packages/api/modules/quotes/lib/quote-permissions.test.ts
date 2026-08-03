import { admin, manager, owner } from "@repo/auth/lib/permissions";
import { describe, expect, it } from "vitest";

const lifecycleActions = [
	"send",
	"revise",
	"accept",
	"decline",
	"expire",
	"convert",
] as const;

function quoteActions(role: { statements: Record<string, readonly string[]> }) {
	return role.statements.quote ?? [];
}

describe("quote permission contract", () => {
	it("grants owners and admins every lifecycle action and operational detail", () => {
		for (const role of [owner, admin]) {
			expect(quoteActions(role)).toEqual(
				expect.arrayContaining([
					"readOperational",
					...lifecycleActions,
				]),
			);
		}
	});

	it("limits managers to summary access, draft updates, send, and revise", () => {
		expect(quoteActions(manager)).toEqual([
			"update",
			"list",
			"send",
			"revise",
		]);
		for (const forbidden of [
			"read",
			"readOperational",
			"accept",
			"decline",
			"expire",
			"convert",
		]) {
			expect(quoteActions(manager)).not.toContain(forbidden);
		}
	});
});
