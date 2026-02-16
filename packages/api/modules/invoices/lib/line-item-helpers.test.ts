import { describe, expect, it } from "vitest";
import {
	computeLineItemFields,
	isLumpSumType,
	parseItemizedQuantity,
} from "./line-item-helpers";

describe("isLumpSumType", () => {
	it("returns true for milestone", () => {
		expect(isLumpSumType("milestone")).toBe(true);
	});

	it("returns true for expense", () => {
		expect(isLumpSumType("expense")).toBe(true);
	});

	it("returns false for item", () => {
		expect(isLumpSumType("item")).toBe(false);
	});

	it("returns false for service", () => {
		expect(isLumpSumType("service")).toBe(false);
	});
});

describe("computeLineItemFields", () => {
	it("returns null qty/unitPrice for lump-sum milestone", () => {
		const result = computeLineItemFields(
			{ amount: "50000.00" },
			"milestone",
		);
		expect(result).toEqual({
			type: "milestone",
			quantity: null,
			unitPrice: null,
			amount: "50000.00",
		});
	});

	it("returns null qty/unitPrice for lump-sum expense", () => {
		const result = computeLineItemFields({ amount: "10000.00" }, "expense");
		expect(result).toEqual({
			type: "expense",
			quantity: null,
			unitPrice: null,
			amount: "10000.00",
		});
	});

	it("computes amount for itemized item type", () => {
		const result = computeLineItemFields(
			{ quantity: "200", unitPrice: "150.00" },
			"item",
		);
		expect(result).toEqual({
			type: "item",
			quantity: "200",
			unitPrice: "150.00",
			amount: "30000.00",
		});
	});

	it("computes amount for itemized service type", () => {
		const result = computeLineItemFields(
			{ quantity: "8", unitPrice: "5000.00" },
			"service",
		);
		expect(result).toEqual({
			type: "service",
			quantity: "8",
			unitPrice: "5000.00",
			amount: "40000.00",
		});
	});

	it("handles zero-amount lump-sum (complimentary item)", () => {
		const result = computeLineItemFields({ amount: "0.00" }, "milestone");
		expect(result).toEqual({
			type: "milestone",
			quantity: null,
			unitPrice: null,
			amount: "0.00",
		});
	});

	it("throws when lump-sum amount is missing", () => {
		expect(() =>
			computeLineItemFields(
				{ quantity: null, unitPrice: null },
				"milestone",
			),
		).toThrow("Amount is required for milestone/expense");
	});

	it("normalizes unitPrice through cents conversion", () => {
		const result = computeLineItemFields(
			{ quantity: "1", unitPrice: "99.99" },
			"item",
		);
		expect(result).toEqual({
			type: "item",
			quantity: "1",
			unitPrice: "99.99",
			amount: "99.99",
		});
	});
});

describe("parseItemizedQuantity", () => {
	it("accepts whole-number decimal strings from DB", () => {
		expect(parseItemizedQuantity("200.00")).toBe(200);
	});

	it("rejects fractional quantities", () => {
		expect(() => parseItemizedQuantity("2.5")).toThrow(
			"Quantity must be a whole number",
		);
	});

	it("rejects zero quantity", () => {
		expect(() => parseItemizedQuantity("0")).toThrow(
			"Quantity must be a positive whole number",
		);
	});
});
