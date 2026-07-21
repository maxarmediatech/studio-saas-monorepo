import { describe, expect, it } from "vitest";
import {
	buildCompactReferenceQuery,
	buildContainsPattern,
	parseExactMoneyQuery,
} from "./search-input";

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

describe("buildCompactReferenceQuery", () => {
	it.each([
		["BK123", "BK123"],
		["RAK2604-0001", "RAK26040001"],
		["RAK-2604-0001", "RAK26040001"],
		["rak 2604/0001", "RAK26040001"],
	])("normalizes %s for separator-insensitive matching", (query, expected) => {
		expect(buildCompactReferenceQuery(query)).toBe(expected);
	});

	it.each([
		"Priya",
		"123",
		"BK",
		"",
	])("does not interpret %s as a reference", (query) => {
		expect(buildCompactReferenceQuery(query)).toBeNull();
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
