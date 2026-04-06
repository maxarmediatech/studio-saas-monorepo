import { expect, test } from "@playwright/test";
import {
	getNotificationEntityHref,
	getNotificationsPageHref,
} from "../modules/saas/studio/components/notifications/routes";

test.describe("notification routes", () => {
	test("builds task detail routes", () => {
		expect(
			getNotificationEntityHref("stuwiz", {
				entityType: "task",
				entityId: "task_123",
			}),
		).toBe("/app/stuwiz/tasks/task_123");
	});

	test("builds deliverable detail routes", () => {
		expect(
			getNotificationEntityHref("stuwiz", {
				entityType: "deliverable",
				entityId: "del_123",
			}),
		).toBe("/app/stuwiz/deliverables/del_123");
	});

	test("builds shoot detail routes", () => {
		expect(
			getNotificationEntityHref("stuwiz", {
				entityType: "shoot",
				entityId: "shoot_123",
			}),
		).toBe("/app/stuwiz/shoots/shoot_123");
	});

	test("returns null when organization slug is unavailable", () => {
		expect(
			getNotificationEntityHref(undefined, {
				entityType: "task",
				entityId: "task_123",
			}),
		).toBeNull();
	});

	test("builds notifications page route", () => {
		expect(getNotificationsPageHref("stuwiz")).toBe(
			"/app/stuwiz/notifications",
		);
	});
});
