import { describe, expect, it } from "vitest";
import {
	getCalendarDateKey,
	getMinutesSinceMidnight,
	getTimeZoneLabel,
} from "./calendar-timezone";

const instant = new Date("2026-07-20T20:00:00.000Z");

describe("calendar timezone helpers", () => {
	it("uses the selected timezone for the current calendar day", () => {
		expect(getCalendarDateKey(instant, "Asia/Kolkata")).toBe("2026-07-21");
		expect(getCalendarDateKey(instant, "America/Los_Angeles")).toBe(
			"2026-07-20",
		);
	});

	it("positions the current-time line in the selected timezone", () => {
		expect(getMinutesSinceMidnight(instant, "Asia/Kolkata")).toBe(90);
		expect(getMinutesSinceMidnight(instant, "America/Los_Angeles")).toBe(
			13 * 60,
		);
	});

	it("keeps numeric GMT offsets instead of replacing them with Local", () => {
		expect(getTimeZoneLabel(instant, "Asia/Kolkata")).not.toBe("Local");
	});
});
