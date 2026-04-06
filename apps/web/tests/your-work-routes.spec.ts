import { expect, test } from "@playwright/test";
import { getYourWorkEntityHref } from "../modules/saas/studio/components/your-work/routes";

test.describe("your work routes", () => {
	test("builds task detail routes instead of task edit sheet query params", () => {
		expect(
			getYourWorkEntityHref("stuwiz", {
				entityType: "task",
				entityId: "task_123",
			}),
		).toBe("/app/stuwiz/tasks/task_123");
	});

	test("builds deliverable detail routes instead of edit sheet query params", () => {
		expect(
			getYourWorkEntityHref("stuwiz", {
				entityType: "deliverable",
				entityId: "del_123",
			}),
		).toBe("/app/stuwiz/deliverables/del_123");
	});

	test("builds shoot detail routes instead of edit sheet query params", () => {
		expect(
			getYourWorkEntityHref("stuwiz", {
				entityType: "shoot",
				entityId: "shoot_123",
			}),
		).toBe("/app/stuwiz/shoots/shoot_123");
	});
});
