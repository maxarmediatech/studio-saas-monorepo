import { describe, expect, it } from "vitest";
import {
	BULK_INVITE_MAX_EMAILS,
	buildBulkInviteSummary,
	classifyBulkInviteErrorMessage,
	parseBulkInviteText,
	prepareBulkInviteBatch,
} from "./bulk-invitations";

describe("bulk invitation parsing", () => {
	it("parses newline, comma, and semicolon separated emails", () => {
		const parsed = parseBulkInviteText(
			"alice@example.com,\nbob@example.com;carol@example.com",
		);

		expect(parsed.readyEmails).toEqual([
			"alice@example.com",
			"bob@example.com",
			"carol@example.com",
		]);
		expect(parsed.requestedCount).toBe(3);
	});

	it("trims, lowercases, and de-dupes emails", () => {
		const parsed = prepareBulkInviteBatch([
			" Alice@Example.com ",
			"bob@example.com",
			"alice@example.com",
		]);

		expect(parsed.readyEmails).toEqual([
			"alice@example.com",
			"bob@example.com",
		]);
		expect(parsed.duplicateCount).toBe(1);
		expect(parsed.entries[2]).toMatchObject({
			email: "alice@example.com",
			status: "duplicate_in_batch",
		});
	});

	it("marks invalid emails without blocking valid ones", () => {
		const parsed = prepareBulkInviteBatch([
			"alice@example.com",
			"not-an-email",
			"bob@example.com",
		]);

		expect(parsed.invalidCount).toBe(1);
		expect(parsed.entries[1]).toMatchObject({
			email: "not-an-email",
			status: "invalid_email",
		});
		expect(parsed.readyEmails).toEqual([
			"alice@example.com",
			"bob@example.com",
		]);
	});

	it("tracks when the unique valid email limit is exceeded", () => {
		const parsed = prepareBulkInviteBatch(
			Array.from(
				{ length: BULK_INVITE_MAX_EMAILS + 1 },
				(_, index) => `person${index + 1}@example.com`,
			),
		);

		expect(parsed.normalizedCount).toBe(BULK_INVITE_MAX_EMAILS + 1);
		expect(parsed.withinLimit).toBe(false);
	});
});

describe("bulk invitation summaries", () => {
	it("counts created, skipped, and failed statuses", () => {
		const summary = buildBulkInviteSummary({
			requestedCount: 5,
			normalizedCount: 4,
			results: [
				{ email: "a@example.com", status: "created" },
				{ email: "b@example.com", status: "already_member" },
				{ email: "c@example.com", status: "already_invited" },
				{ email: "d@example.com", status: "duplicate_in_batch" },
				{ email: "e@example.com", status: "failed" },
			],
		});

		expect(summary).toEqual({
			requested: 5,
			normalized: 4,
			created: 1,
			skipped: 3,
			failed: 1,
		});
	});
});

describe("bulk invitation error classification", () => {
	it("maps permission and limit messages to bulk statuses", () => {
		expect(
			classifyBulkInviteErrorMessage(
				"You are not allowed to invite users to this organization",
			),
		).toBe("forbidden");
		expect(classifyBulkInviteErrorMessage("Invitation limit reached")).toBe(
			"limit_reached",
		);
	});

	it("falls back to failed for unknown messages", () => {
		expect(classifyBulkInviteErrorMessage("Unexpected boom")).toBe(
			"failed",
		);
	});
});
