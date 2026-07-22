import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	hasPermission: vi.fn(),
}));

vi.mock("@repo/auth", () => ({
	auth: {
		api: {
			hasPermission: mocks.hasPermission,
		},
	},
}));

import { hasPermission } from "./permissions";

describe("hasPermission", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.hasPermission.mockResolvedValue({ success: true });
	});

	it("checks permissions against the explicit organization context", async () => {
		const headers = new Headers();

		await expect(
			hasPermission(
				{ headers, organizationId: "route-organization" },
				"discussion",
				"update",
			),
		).resolves.toBe(true);

		expect(mocks.hasPermission).toHaveBeenCalledWith({
			headers,
			body: {
				organizationId: "route-organization",
				permissions: { discussion: ["update"] },
			},
		});
	});
});
