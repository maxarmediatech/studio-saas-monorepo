import { describe, expect, it } from "vitest";
import {
	assignedNotificationMetadataSchema,
	notificationMetadataSchema,
	statusChangedNotificationMetadataSchema,
} from "./notification-metadata";

describe("notification metadata", () => {
	it("accepts status change metadata", () => {
		expect(
			statusChangedNotificationMetadataSchema.parse({
				oldStatus: "pending",
				newStatus: "completed",
			}),
		).toEqual({
			oldStatus: "pending",
			newStatus: "completed",
		});
	});

	it("accepts assignment metadata", () => {
		expect(
			assignedNotificationMetadataSchema.parse({
				assigneeName: "Satish Kumar Tripathy",
				assigneeId: "user_1",
			}),
		).toEqual({
			assigneeName: "Satish Kumar Tripathy",
			assigneeId: "user_1",
		});
	});

	it("allows missing metadata for legacy notifications", () => {
		expect(notificationMetadataSchema.parse(null)).toBeNull();
	});
});
