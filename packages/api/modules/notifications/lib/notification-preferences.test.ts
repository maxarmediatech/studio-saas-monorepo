import { describe, expect, it } from "vitest";
import {
	defaultNotificationPreferences,
	getEffectiveNotificationPreferences,
	shouldNotifyForReasons,
} from "./notification-preferences";

describe("notification preferences", () => {
	it("falls back to default preferences when row is missing", () => {
		expect(getEffectiveNotificationPreferences()).toEqual(
			defaultNotificationPreferences,
		);
	});

	it("allows a notification when any recipient reason is enabled", () => {
		expect(
			shouldNotifyForReasons(
				getEffectiveNotificationPreferences({
					itemsIFollow: false,
				}),
				["subscriber", "booking_owner"],
			),
		).toBe(true);
	});

	it("suppresses a notification when every matching reason is disabled", () => {
		expect(
			shouldNotifyForReasons(
				getEffectiveNotificationPreferences({
					assignedToMe: false,
					itemsIFollow: false,
				}),
				["assignee", "subscriber"],
			),
		).toBe(false);
	});
});
