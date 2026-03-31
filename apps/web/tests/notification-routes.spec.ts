import { expect, test } from "@playwright/test";
import { getNotificationEntityHref } from "../modules/saas/studio/components/notifications/routes";

test.describe("notification routes", () => {
	test("builds task detail routes", () => {
		expect(
			getNotificationEntityHref("acme", {
				entityType: "task",
				entityId: "task_123",
			}),
		).toBe("/app/acme/tasks/task_123");
	});

	test("builds deliverable detail routes", () => {
		expect(
			getNotificationEntityHref("acme", {
				entityType: "deliverable",
				entityId: "del_123",
			}),
		).toBe("/app/acme/deliverables/del_123");
	});

	test("builds shoot detail routes", () => {
		expect(
			getNotificationEntityHref("acme", {
				entityType: "shoot",
				entityId: "shoot_123",
			}),
		).toBe("/app/acme/shoots/shoot_123");
	});

	test("returns null when organization slug is unavailable", () => {
		expect(
			getNotificationEntityHref(undefined, {
				entityType: "task",
				entityId: "task_123",
			}),
		).toBeNull();
	});
});
