import { describe, expect, it } from "vitest";
import {
	buildConvertedDeliverableMetadata,
	getConvertedTaskIdFromMetadata,
} from "./convert-to-task";

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
