"use client";

import { parseAsBoolean, parseAsStringEnum, useQueryState } from "nuqs";

const assignmentTypes = ["all", "task", "deliverable"] as const;
const statuses = [
	"ready_for_review",
	"changes_requested",
	"approved",
	"rejected",
] as const;

export function useReviewQueueParams() {
	const [assignmentType, setAssignmentType] = useQueryState(
		"assignmentType",
		parseAsStringEnum(Array.from(assignmentTypes)).withDefault("all"),
	);

	const [status, setStatus] = useQueryState(
		"status",
		parseAsStringEnum(Array.from(statuses)).withDefault(
			"ready_for_review",
		),
	);

	const [assignedToMe, setAssignedToMe] = useQueryState(
		"assignedToMe",
		parseAsBoolean.withDefault(false),
	);

	return {
		assignmentType: assignmentType as (typeof assignmentTypes)[number],
		setAssignmentType,
		status: status as (typeof statuses)[number],
		setStatus,
		assignedToMe,
		setAssignedToMe,
	};
}
