import { describe, expect, it } from "vitest";
import {
	assignedNotificationMetadataSchema,
	deadlineReminderNotificationMetadataSchema,
	notificationMetadataSchema,
	reviewDecisionNotificationMetadataSchema,
	reviewRequestedNotificationMetadataSchema,
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

	it("accepts assignment progress metadata without conflating parent status", () => {
		expect(
			statusChangedNotificationMetadataSchema.parse({
				oldStatus: "assigned",
				newStatus: "blocked",
				changeScope: "assignment_progress",
				crewId: "crew_1",
				crewName: "Asha",
			}),
		).toEqual({
			oldStatus: "assigned",
			newStatus: "blocked",
			changeScope: "assignment_progress",
			crewId: "crew_1",
			crewName: "Asha",
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

	it("accepts review metadata", () => {
		expect(
			reviewRequestedNotificationMetadataSchema.parse({
				submittedByName: "Satish Kumar Tripathy",
			}),
		).toEqual({
			submittedByName: "Satish Kumar Tripathy",
		});

		expect(
			reviewDecisionNotificationMetadataSchema.parse({
				outcome: "revision_requested",
				scope: "submission_decision",
				parentStatus: "revision_requested",
				reviewerName: "Rakesh",
				reviewNote: "Please tighten the first cut",
			}),
		).toEqual({
			outcome: "revision_requested",
			scope: "submission_decision",
			parentStatus: "revision_requested",
			reviewerName: "Rakesh",
			reviewNote: "Please tighten the first cut",
		});
	});

	it("accepts deadline reminder metadata", () => {
		expect(
			deadlineReminderNotificationMetadataSchema.parse({
				kind: "due_soon",
				dueDate: "2026-04-02",
				daysUntilDue: 1,
			}),
		).toEqual({
			kind: "due_soon",
			dueDate: "2026-04-02",
			daysUntilDue: 1,
		});
	});

	it("allows missing metadata for legacy notifications", () => {
		expect(notificationMetadataSchema.parse(null)).toBeNull();
	});
});
