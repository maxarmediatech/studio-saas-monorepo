import { describe, expect, it } from "vitest";
import { buildShootAllDayEventInput } from "@repo/google-calendar";

describe("buildShootAllDayEventInput title", () => {
	it("uses booking name and shoot type in title", () => {
		const input = buildShootAllDayEventInput({
			bookingName: "Aditi & Raj Wedding",
			shootType: "Reception",
			shootName: "reception",
			shootDate: "2026-02-20",
			crewRole: "Crew",
		});

		expect(input.title).toBe("Aditi & Raj Wedding — Reception");
	});

	it("adds shoot name when distinct from shoot type", () => {
		const input = buildShootAllDayEventInput({
			bookingName: "Aditi & Raj Wedding",
			shootType: "Wedding",
			shootName: "Mehendi",
			shootDate: "2026-02-20",
		});

		expect(input.title).toBe("Aditi & Raj Wedding — Wedding — Mehendi");
	});

	it("falls back to shoot type when booking name is missing", () => {
		const input = buildShootAllDayEventInput({
			bookingName: null,
			shootType: "Wedding",
			shootName: "Wedding",
			shootDate: "2026-02-20",
		});

		expect(input.title).toBe("Wedding");
	});
});
