import { expect, test } from "@playwright/test";
import { getNotificationBodyText } from "../modules/saas/studio/components/notifications/content";

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
});
