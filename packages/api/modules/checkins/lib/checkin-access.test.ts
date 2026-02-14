import { ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	assertCheckinTypeAccess,
	assertTeamExistsInOrganization,
	assertUserIsMemberOfTeam,
	getTeamsForUser,
} from "./checkin-access";

const mocks = vi.hoisted(() => ({
	mockCheckinTypesFindFirst: vi.fn(),
	mockTeamMembersFindFirst: vi.fn(),
	mockTeamMembersFindMany: vi.fn(),
	mockTeamsFindFirst: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	db: {
		query: {
			checkinTypes: { findFirst: mocks.mockCheckinTypesFindFirst },
			teamMembers: {
				findFirst: mocks.mockTeamMembersFindFirst,
				findMany: mocks.mockTeamMembersFindMany,
			},
			teams: { findFirst: mocks.mockTeamsFindFirst },
		},
	},
	and: vi.fn((...args) => args),
	eq: vi.fn((a, b) => ({ eq: [a, b] })),
	isNull: vi.fn((a) => ({ isNull: a })),
	checkinTypes: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
		scope: "scope",
		teamId: "teamId",
	},
	teamMembers: {
		teamId: "teamId",
		userId: "userId",
	},
	teams: {
		id: "id",
		organizationId: "organizationId",
	},
	checkins: {
		id: "id",
		organizationId: "organizationId",
		deletedAt: "deletedAt",
	},
}));

const baseContext = {
	organizationId: "org_1",
	user: { id: "user_1" },
	membership: { role: "member" },
};

const expectOrpcErrorCode = (error: unknown, code: string): void => {
	expect(error).toBeInstanceOf(ORPCError);
	expect((error as { code?: string }).code).toBe(code);
};

describe("assertCheckinTypeAccess", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns checkin type for admin regardless of scope", async () => {
		const checkinType = {
			id: "ct_1",
			organizationId: "org_1",
			scope: "team",
			teamId: "team_1",
		};
		mocks.mockCheckinTypesFindFirst.mockResolvedValue(checkinType);

		const result = await assertCheckinTypeAccess("ct_1", {
			...baseContext,
			membership: { role: "owner" },
		});

		expect(result).toEqual(checkinType);
		expect(mocks.mockTeamMembersFindFirst).not.toHaveBeenCalled();
	});

	it("returns org-scoped checkin for non-admin", async () => {
		const checkinType = {
			id: "ct_2",
			organizationId: "org_1",
			scope: "organization",
			teamId: null,
		};
		mocks.mockCheckinTypesFindFirst.mockResolvedValue(checkinType);

		const result = await assertCheckinTypeAccess("ct_2", baseContext);

		expect(result).toEqual(checkinType);
		expect(mocks.mockTeamMembersFindFirst).not.toHaveBeenCalled();
	});

	it("throws FORBIDDEN for non-member on team-scoped checkin", async () => {
		mocks.mockCheckinTypesFindFirst.mockResolvedValue({
			id: "ct_3",
			organizationId: "org_1",
			scope: "team",
			teamId: "team_1",
		});
		mocks.mockTeamMembersFindFirst.mockResolvedValue(null);

		await expect(
			assertCheckinTypeAccess("ct_3", baseContext),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "FORBIDDEN");
			return true;
		});
	});

	it("returns team-scoped checkin for team member", async () => {
		const checkinType = {
			id: "ct_4",
			organizationId: "org_1",
			scope: "team",
			teamId: "team_1",
		};
		mocks.mockCheckinTypesFindFirst.mockResolvedValue(checkinType);
		mocks.mockTeamMembersFindFirst.mockResolvedValue({
			teamId: "team_1",
			userId: "user_1",
		});

		const result = await assertCheckinTypeAccess("ct_4", baseContext);

		expect(result).toEqual(checkinType);
	});

	it("throws NOT_FOUND when checkin type does not exist", async () => {
		mocks.mockCheckinTypesFindFirst.mockResolvedValue(null);

		await expect(
			assertCheckinTypeAccess("ct_missing", baseContext),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "NOT_FOUND");
			return true;
		});
	});

	it("throws FORBIDDEN when team-scoped checkin has null teamId", async () => {
		mocks.mockCheckinTypesFindFirst.mockResolvedValue({
			id: "ct_6",
			organizationId: "org_1",
			scope: "team",
			teamId: null,
		});

		await expect(
			assertCheckinTypeAccess("ct_6", baseContext),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "FORBIDDEN");
			return true;
		});
	});
});

describe("assertTeamExistsInOrganization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns void when team exists in org", async () => {
		mocks.mockTeamsFindFirst.mockResolvedValue({ id: "team_1" });

		await expect(
			assertTeamExistsInOrganization("team_1", "org_1"),
		).resolves.toBeUndefined();
	});

	it("throws NOT_FOUND when team does not exist", async () => {
		mocks.mockTeamsFindFirst.mockResolvedValue(null);

		await expect(
			assertTeamExistsInOrganization("team_missing", "org_1"),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "NOT_FOUND");
			return true;
		});
	});

	it("throws NOT_FOUND when team belongs to a different org", async () => {
		mocks.mockTeamsFindFirst.mockResolvedValue(null);

		await expect(
			assertTeamExistsInOrganization("team_other_org", "org_1"),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "NOT_FOUND");
			return true;
		});
	});
});

describe("assertUserIsMemberOfTeam", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns void when user is a team member", async () => {
		mocks.mockTeamMembersFindFirst.mockResolvedValue({ teamId: "team_1" });

		await expect(
			assertUserIsMemberOfTeam("team_1", "user_1"),
		).resolves.toBeUndefined();
	});

	it("throws FORBIDDEN when user is not a team member", async () => {
		mocks.mockTeamMembersFindFirst.mockResolvedValue(null);

		await expect(
			assertUserIsMemberOfTeam("team_1", "user_1"),
		).rejects.toSatisfy((error: unknown) => {
			expectOrpcErrorCode(error, "FORBIDDEN");
			return true;
		});
	});
});

describe("getTeamsForUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns team ids filtered to the organization", async () => {
		mocks.mockTeamMembersFindMany.mockResolvedValue([
			{
				teamId: "team_1",
				team: { id: "team_1", organizationId: "org_1" },
			},
			{
				teamId: "team_2",
				team: { id: "team_2", organizationId: "org_2" },
			},
			{
				teamId: "team_3",
				team: { id: "team_3", organizationId: "org_1" },
			},
		]);

		const result = await getTeamsForUser("user_1", "org_1");

		expect(result).toEqual(["team_1", "team_3"]);
	});

	it("returns empty array when user has no teams in org", async () => {
		mocks.mockTeamMembersFindMany.mockResolvedValue([
			{
				teamId: "team_2",
				team: { id: "team_2", organizationId: "org_2" },
			},
		]);

		const result = await getTeamsForUser("user_1", "org_1");

		expect(result).toEqual([]);
	});
});
