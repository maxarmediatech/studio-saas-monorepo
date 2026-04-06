import { describe, expect, it } from "vitest";
import { deriveStudioPrefix } from "../derive-studio-prefix";

describe("deriveStudioPrefix", () => {
	it("single word → first 3 characters uppercase", () => {
		expect(deriveStudioPrefix("Snapworks")).toBe("SNA");
	});

	it("two words → initials uppercase", () => {
		expect(deriveStudioPrefix("Studio Wiz")).toBe("SW");
	});

	it("three or more words → first 3 initials uppercase", () => {
		expect(deriveStudioPrefix("The Royal Photo Co")).toBe("TRP");
	});

	it("filters out non-alpha words", () => {
		expect(deriveStudioPrefix("A & B Studios")).toBe("ABS");
	});

	it("strips wildcard and symbol characters from words", () => {
		expect(deriveStudioPrefix("A%_ Studio")).toBe("AS");
	});

	it("single-word names keep only letters", () => {
		expect(deriveStudioPrefix("%%S!n@ap#1")).toBe("SNA");
	});

	it("empty string → BKN fallback", () => {
		expect(deriveStudioPrefix("")).toBe("BKN");
	});

	it("whitespace only → BKN fallback", () => {
		expect(deriveStudioPrefix("   ")).toBe("BKN");
	});

	it("single character name", () => {
		expect(deriveStudioPrefix("X")).toBe("X");
	});

	it("short single word", () => {
		expect(deriveStudioPrefix("Hi")).toBe("HI");
	});

	it("lowercase input is uppercased", () => {
		expect(deriveStudioPrefix("pixel perfect studio")).toBe("PPS");
	});

	it("handles extra whitespace between words", () => {
		expect(deriveStudioPrefix("  Studio   Wiz  ")).toBe("SW");
	});
});
