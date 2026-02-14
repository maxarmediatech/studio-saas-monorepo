import { describe, expect, it } from "vitest";
import {
	createCheckinTypeInputSchema,
	updateCheckinTypeInputSchema,
} from "./schemas";

describe("checkin type schema", () => {
	it("allows organization scope without a team", () => {
		const result = createCheckinTypeInputSchema.safeParse({
			name: "Daily Updates",
			scope: "organization",
			frequency: "daily",
		});

		expect(result.success).toBe(true);
	});

	it("requires teamId for team scope", () => {
		const result = createCheckinTypeInputSchema.safeParse({
			name: "Editors Sync",
			scope: "team",
			frequency: "daily",
		});

		expect(result.success).toBe(false);
	});

	it("rejects teamId for organization scope", () => {
		const result = createCheckinTypeInputSchema.safeParse({
			name: "All Hands",
			scope: "organization",
			teamId: "team_123",
			frequency: "weekly",
		});

		expect(result.success).toBe(false);
	});

	it("allows switching to organization scope with null teamId on update", () => {
		const result = updateCheckinTypeInputSchema.safeParse({
			checkinTypeId: "ct_123",
			scope: "organization",
			teamId: null,
		});

		expect(result.success).toBe(true);
	});
});
