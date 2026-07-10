import { describe, expect, it } from "vitest";
import {
	getCalendarDeleteJobType,
	isTerminalShootStatus,
	normalizeShootStatus,
} from "./calendar-sync";

describe("normalizeShootStatus", () => {
	it("normalizes case and whitespace", () => {
		expect(normalizeShootStatus("  Cancelled ")).toBe("cancelled");
	});

	it("returns empty string for nullish values", () => {
		expect(normalizeShootStatus(null)).toBe("");
		expect(normalizeShootStatus(undefined)).toBe("");
	});
});

describe("isTerminalShootStatus", () => {
	it("returns true for cancelled/completed", () => {
		expect(isTerminalShootStatus("cancelled")).toBe(true);
		expect(isTerminalShootStatus("Completed")).toBe(true);
	});

	it("returns false for non-terminal statuses", () => {
		expect(isTerminalShootStatus("scheduled")).toBe(false);
		expect(isTerminalShootStatus("in_progress")).toBe(false);
	});
});

describe("getCalendarDeleteJobType", () => {
	it("maps delivery methods to delete/cancel jobs", () => {
		expect(getCalendarDeleteJobType("google")).toBe("google_delete");
		expect(getCalendarDeleteJobType("ics")).toBe("ics_send_cancel");
		expect(getCalendarDeleteJobType("unsendable")).toBeNull();
	});
});
