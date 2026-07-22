import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getOrganizationBySlug: vi.fn(),
	getOrganizationMembership: vi.fn(),
}));

vi.mock("@repo/database", () => ({
	getOrganizationBySlug: mocks.getOrganizationBySlug,
	getOrganizationMembership: mocks.getOrganizationMembership,
}));

import { resolveOrganizationRouteContext } from "./organization-route";

const context = {
	headers: new Headers(),
	session: {
		id: "session-1",
		userId: "user-1",
		activeOrganizationId: "active-organization",
	},
	user: {
		id: "user-1",
		email: "user@example.com",
		name: "User",
	},
};

const routeOrganization = {
	id: "route-organization",
	name: "Route Organization",
	slug: "route-org",
	timezone: "Asia/Kolkata",
};

describe("resolveOrganizationRouteContext", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.getOrganizationBySlug.mockResolvedValue(routeOrganization);
		mocks.getOrganizationMembership.mockResolvedValue({
			id: "membership-1",
			role: "member",
			organization: routeOrganization,
		});
	});

	it("uses the route organization instead of the active session organization", async () => {
		const result = await resolveOrganizationRouteContext(
			"route-org",
			context,
		);

		expect(mocks.getOrganizationMembership).toHaveBeenCalledWith(
			"route-organization",
			"user-1",
		);
		expect(result.organizationId).toBe("route-organization");
	});

	it("rejects an unknown route organization", async () => {
		mocks.getOrganizationBySlug.mockResolvedValue(null);

		await expect(
			resolveOrganizationRouteContext("missing-org", context),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("rejects a user who is not a member of the route organization", async () => {
		mocks.getOrganizationMembership.mockResolvedValue(null);

		await expect(
			resolveOrganizationRouteContext("route-org", context),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});
});
