import { describe, expect, it } from "vitest";
import { buildContainsPattern, parseExactMoneyQuery } from "./search-input";

describe("buildContainsPattern", () => {
	it("trims input and creates a contains pattern", () => {
		expect(buildContainsPattern("  Priya Sharma  ")).toBe("%Priya Sharma%");
	});

	it("escapes PostgreSQL LIKE wildcard characters", () => {
		expect(buildContainsPattern("50%_paid\\today")).toBe(
			"%50\\%\\_paid\\\\today%",
		);
	});

	it("returns null for an empty query", () => {
		expect(buildContainsPattern("   ")).toBeNull();
	});
});

describe("parseExactMoneyQuery", () => {
	it.each([
		["50000", "50000.00"],
		["50,000", "50000.00"],
		["₹ 50,000.5", "50000.50"],
		["000125.25", "125.25"],
	])("normalizes %s for an exact decimal comparison", (query, expected) => {
		expect(parseExactMoneyQuery(query)).toBe(expected);
	});

	it.each([
		"Priya",
		"50k",
		"500.123",
		"10-20",
		"12/05/2026",
	])("does not interpret %s as money", (query) => {
		expect(parseExactMoneyQuery(query)).toBeNull();
	});
});
