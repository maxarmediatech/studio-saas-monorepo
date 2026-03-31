import { describe, expect, it } from "vitest";
import {
	buildRecipientReasons,
	type EntityNotificationContext,
	type NotifyEntityUsersInput,
} from "./recipient-rules";

const baseInput: NotifyEntityUsersInput = {
	organizationId: "org_1",
	entityType: "task",
	entityId: "task_1",
	entityName: "Edit teaser",
	type: "status_changed",
	title: "Task status updated: Edit teaser",
};

const baseContext: EntityNotificationContext = {
	assignerUserIds: ["assigner_1"],
	assigneeUserIds: ["assignee_1", "assignee_2"],
	bookingOwnerUserId: "owner_1",
};

function toRecord(map: Map<string, Set<string>>) {
	return Object.fromEntries(
		[...map.entries()].map(([userId, reasons]) => [
			userId,
			[...reasons].sort(),
		]),
	);
}

describe("recipient rules", () => {
	it("routes review requested to assigner, booking owner, and followers", () => {
		const reasons = buildRecipientReasons(
			{
				...baseInput,
				type: "review_requested",
				metadata: { submittedByName: "Satish" },
			},
			baseContext,
			["subscriber_1"],
		);

		expect(toRecord(reasons)).toEqual({
			assigner_1: ["assigner"],
			owner_1: ["booking_owner"],
			subscriber_1: ["subscriber"],
		});
	});

	it("routes review decisions back to assignees plus managerial watchers", () => {
		const reasons = buildRecipientReasons(
			{
				...baseInput,
				type: "review_revision_requested",
				metadata: {
					outcome: "revision_requested",
					reviewerName: "Rakesh",
					reviewNote: "Tighten the cut",
				},
			},
			baseContext,
			["subscriber_1"],
		);

		expect(toRecord(reasons)).toEqual({
			assigner_1: ["assigner"],
			assignee_1: ["assignee"],
			assignee_2: ["assignee"],
			owner_1: ["booking_owner"],
			subscriber_1: ["subscriber"],
		});
	});

	it("treats overdue reminders as reminder signals and includes booking owner", () => {
		const reasons = buildRecipientReasons(
			{
				...baseInput,
				type: "overdue",
				metadata: {
					kind: "overdue",
					dueDate: "2026-04-01",
					daysUntilDue: null,
				},
			},
			baseContext,
			["subscriber_1"],
		);

		expect(toRecord(reasons)).toEqual({
			assignee_1: ["reminder"],
			assignee_2: ["reminder"],
			owner_1: ["reminder"],
			subscriber_1: ["reminder"],
		});
	});
});
