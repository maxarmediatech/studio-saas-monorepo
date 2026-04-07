import { describe, expect, it } from "vitest";
import { getSavedViewPermissionResource } from "./saved-view-permissions";

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
