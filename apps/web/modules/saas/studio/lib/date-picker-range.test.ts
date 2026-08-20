import { getDefaultDatePickerEndMonth } from "@repo/ui/lib/date-picker-range";
import { describe, expect, it } from "vitest";

describe("getDefaultDatePickerEndMonth", () => {
	it("keeps future years available in the year dropdown", () => {
		const endMonth = getDefaultDatePickerEndMonth(new Date(2026, 7, 20));

		expect(endMonth).toEqual(new Date(2036, 11, 31));
	});
});
