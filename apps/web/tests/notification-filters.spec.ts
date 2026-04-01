import { expect, test } from "@playwright/test";
import {
	getNotificationEmptyStateCopy,
	getNotificationTypesForFilter,
} from "../modules/saas/studio/components/notifications/filters";

test.describe("notification filters", () => {
	test("maps review filter to review notification types", () => {
		expect(getNotificationTypesForFilter("reviews")).toEqual([
			"review_requested",
			"review_approved",
			"review_rejected",
			"review_revision_requested",
		]);
	});

	test("maps reminders filter to reminder notification types", () => {
		expect(getNotificationTypesForFilter("reminders")).toEqual([
			"due_soon",
			"overdue",
		]);
	});

	test("returns undefined for all types filter", () => {
		expect(getNotificationTypesForFilter("all")).toBeUndefined();
	});

	test("uses type-aware unread empty-state copy", () => {
		expect(getNotificationEmptyStateCopy("unread", "reviews")).toEqual({
			title: "No unread notifications in this type.",
			description: "You’re all caught up.",
		});
	});
});
