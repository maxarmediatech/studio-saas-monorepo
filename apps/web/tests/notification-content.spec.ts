import { expect, test } from "@playwright/test";
import {
	getNotificationBodyText,
	getNotificationTypeLabel,
} from "../modules/saas/studio/components/notifications/content";

const statusLabelMaps = {
	task_status: {
		in_progress: "In Progress",
		blocked: "Blocked",
	},
	deliverable_status: {},
	shoot_status: {},
};

test.describe("notification content", () => {
	test("renders config-backed labels for legacy status transitions", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_1",
					entityType: "task",
					entityId: "task_1",
					entityName: "Edit film",
					type: "status_changed",
					title: "Task status updated: Edit film",
					body: "in_progress -> blocked",
					metadata: null,
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("In Progress -> Blocked");
	});

	test("prefers metadata for new status notifications", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_2",
					entityType: "task",
					entityId: "task_2",
					entityName: "Edit teaser",
					type: "status_changed",
					title: "Task status updated: Edit teaser",
					body: "pending -> completed",
					metadata: {
						oldStatus: "in_progress",
						newStatus: "blocked",
					},
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("In Progress -> Blocked");
	});

	test("falls back to assignment metadata when present", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_3",
					entityType: "shoot",
					entityId: "shoot_1",
					entityName: "Wedding day",
					type: "assigned",
					title: "Shoot assigned: Wedding day",
					body: null,
					metadata: {
						assigneeName: "Satish Kumar Tripathy",
						assigneeId: "user_1",
					},
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("Assigned to Satish Kumar Tripathy");
	});

	test("humanizes unknown status keys when config labels are missing", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_4",
					entityType: "deliverable",
					entityId: "deliverable_1",
					entityName: "Album",
					type: "status_changed",
					title: "Deliverable status updated: Album",
					body: "awaiting_review -> client_approved",
					metadata: null,
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("Awaiting Review -> Client Approved");
	});

	test("renders review request copy from metadata", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_5",
					entityType: "task",
					entityId: "task_5",
					entityName: "Edit reel",
					type: "review_requested",
					title: "Task submitted for review: Edit reel",
					body: null,
					metadata: {
						submittedByName: "Satish Kumar Tripathy",
					},
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("Submitted by Satish Kumar Tripathy");
	});

	test("renders review decision copy with note", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_6",
					entityType: "deliverable",
					entityId: "deliverable_6",
					entityName: "Wedding film",
					type: "review_revision_requested",
					title: "Deliverable needs changes: Wedding film",
					body: null,
					metadata: {
						outcome: "revision_requested",
						reviewerName: "Rakesh",
						reviewNote: "Please tighten the first minute",
					},
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("Changes requested by Rakesh: Please tighten the first minute");
	});

	test("renders due soon reminders from metadata", () => {
		expect(
			getNotificationBodyText(
				{
					id: "notif_7",
					entityType: "task",
					entityId: "task_7",
					entityName: "Album draft",
					type: "due_soon",
					title: "Task due soon: Album draft",
					body: null,
					metadata: {
						kind: "due_soon",
						dueDate: "2026-04-02",
						daysUntilDue: 1,
					},
					actorId: null,
					actorName: null,
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				statusLabelMaps,
			),
		).toBe("Due tomorrow, Apr 2, 2026");
	});

	test("returns compact labels for the new notification types", () => {
		expect(
			getNotificationTypeLabel({
				id: "notif_8",
				entityType: "task",
				entityId: "task_8",
				entityName: "Trailer",
				type: "review_requested",
				title: "Task submitted for review: Trailer",
				body: null,
				metadata: {
					submittedByName: "Satish Kumar Tripathy",
				},
				actorId: null,
				actorName: null,
				readAt: null,
				createdAt: new Date().toISOString(),
			}),
		).toBe("Review");
	});
});
