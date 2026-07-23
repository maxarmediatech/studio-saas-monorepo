import { describe, expect, it } from "vitest";
import {
	buildConvertedDeliverableMetadata,
	canConvertDeliverableToTask,
	deriveConvertedTaskWorkflowStatus,
	getConvertedTaskIdFromMetadata,
} from "./convert-to-task";

describe("deriveConvertedTaskWorkflowStatus", () => {
	it.each([
		[[], "not_started"],
		[["assigned"], "assigned"],
		[["assigned", "in_progress"], "in_progress"],
		[["in_progress", "blocked"], "blocked"],
	] as const)("maps %j assignment progress to %s", (progress, expected) => {
		expect(deriveConvertedTaskWorkflowStatus([...progress])).toBe(expected);
	});
});

describe("getConvertedTaskIdFromMetadata", () => {
	it("returns null for missing metadata", () => {
		expect(getConvertedTaskIdFromMetadata(null)).toBeNull();
		expect(getConvertedTaskIdFromMetadata(undefined)).toBeNull();
		expect(getConvertedTaskIdFromMetadata("invalid")).toBeNull();
	});

	it("returns null for non-string ids", () => {
		expect(
			getConvertedTaskIdFromMetadata({ convertedToTaskId: 123 }),
		).toBeNull();
	});

	it("returns trimmed task id when present", () => {
		expect(
			getConvertedTaskIdFromMetadata({
				convertedToTaskId: " task-123 ",
			}),
		).toBe("task-123");
	});
});

describe("canConvertDeliverableToTask", () => {
	it("rejects legacy metadata conversions that remain in direct mode", () => {
		expect(
			canConvertDeliverableToTask(
				{ convertedToTaskId: "legacy-task" },
				"direct",
			),
		).toBe(false);
	});

	it("allows only unconverted direct-tracking deliverables", () => {
		expect(canConvertDeliverableToTask(null, "direct")).toBe(true);
		expect(canConvertDeliverableToTask(null, "task_based")).toBe(false);
	});
});

describe("buildConvertedDeliverableMetadata", () => {
	it("preserves existing metadata keys", () => {
		const result = buildConvertedDeliverableMetadata(
			{ source: "manual", nested: { a: 1 } },
			"task-123",
			"2026-02-12T10:00:00.000Z",
		);

		expect(result).toEqual({
			source: "manual",
			nested: { a: 1 },
			convertedToTaskId: "task-123",
			convertedAt: "2026-02-12T10:00:00.000Z",
		});
	});

	it("creates metadata object when input is invalid", () => {
		const result = buildConvertedDeliverableMetadata(
			null,
			"task-456",
			"2026-02-12T10:00:00.000Z",
		);

		expect(result).toEqual({
			convertedToTaskId: "task-456",
			convertedAt: "2026-02-12T10:00:00.000Z",
		});
	});
});
