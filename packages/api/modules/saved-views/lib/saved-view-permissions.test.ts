import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	mockHasPermission: vi.fn(),
}));

vi.mock("../../studio/lib/permissions", () => ({
	hasPermission: mocks.mockHasPermission,
}));

import {
	getSavedViewPermissionResource,
	listAuthorizedSavedViewEntityTypes,
} from "./saved-view-permissions";

const context = {
	headers: new Headers(),
	organizationId: "organization-1",
};

describe("listAuthorizedSavedViewEntityTypes", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns workflow entities for directly allowed resources", async () => {
		mocks.mockHasPermission.mockImplementation(
			async (_context, resource: string) => resource === "task",
		);

		await expect(
			listAuthorizedSavedViewEntityTypes(context, "list"),
		).resolves.toEqual(["task"]);
	});

	it("expands payment access to all payment-backed entity types", async () => {
		mocks.mockHasPermission.mockImplementation(
			async (_context, resource: string) => resource === "payment",
		);

		await expect(
			listAuthorizedSavedViewEntityTypes(context, "list"),
		).resolves.toEqual(["payment", "schedule", "invoice"]);
	});

	it("returns an empty list when no resources are authorized", async () => {
		mocks.mockHasPermission.mockResolvedValue(false);

		await expect(
			listAuthorizedSavedViewEntityTypes(context, "list"),
		).resolves.toEqual([]);
	});
});

describe("getSavedViewPermissionResource", () => {
	it("maps workflow entities to their own resources", () => {
		expect(getSavedViewPermissionResource("task")).toBe("task");
		expect(getSavedViewPermissionResource("shoot")).toBe("shoot");
		expect(getSavedViewPermissionResource("deliverable")).toBe(
			"deliverable",
		);
		expect(getSavedViewPermissionResource("expense")).toBe("expense");
	});

	it("maps financial entities to payment permissions", () => {
		expect(getSavedViewPermissionResource("payment")).toBe("payment");
		expect(getSavedViewPermissionResource("schedule")).toBe("payment");
		expect(getSavedViewPermissionResource("invoice")).toBe("payment");
	});

	it("maps directory entities to their own resources", () => {
		expect(getSavedViewPermissionResource("booking")).toBe("booking");
		expect(getSavedViewPermissionResource("client")).toBe("client");
		expect(getSavedViewPermissionResource("crew")).toBe("crew");
	});
});
