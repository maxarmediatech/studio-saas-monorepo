import { describe, expect, it } from "vitest";
import {
	buildReceiptNumber,
	determineInvoiceStatus,
	getNextReceiptNumber,
	type InvoiceStatus,
} from "./receipt-utils";

describe("buildReceiptNumber", () => {
	it("generates receipt number with REC prefix", () => {
		const date = new Date("2025-01-28");
		const result = buildReceiptNumber("BK-001", date);
		expect(result).toBe("REC-BK-001-250128");
	});

	it("formats date as YYMMDD", () => {
		const date = new Date("2024-12-31");
		const result = buildReceiptNumber("REF123", date);
		expect(result).toBe("REC-REF123-241231");
	});

	it("handles different reference number formats", () => {
		const date = new Date("2025-06-15");
		const result = buildReceiptNumber("BOOKING-2025-001", date);
		expect(result).toBe("REC-BOOKING-2025-001-250615");
	});
});

describe("getNextReceiptNumber", () => {
	it("returns base number when no existing receipt", () => {
		const result = getNextReceiptNumber("REC-BK-001-250128", null);
		expect(result).toBe("REC-BK-001-250128");
	});

	it("appends -1 when existing has no sequence", () => {
		const result = getNextReceiptNumber(
			"REC-BK-001-250128",
			"REC-BK-001-250128",
		);
		expect(result).toBe("REC-BK-001-250128-1");
	});

	it("increments sequence number", () => {
		const result = getNextReceiptNumber(
			"REC-BK-001-250128",
			"REC-BK-001-250128-1",
		);
		expect(result).toBe("REC-BK-001-250128-2");
	});

	it("handles larger sequence numbers", () => {
		const result = getNextReceiptNumber(
			"REC-BK-001-250128",
			"REC-BK-001-250128-99",
		);
		expect(result).toBe("REC-BK-001-250128-100");
	});
});

describe("determineInvoiceStatus", () => {
	const testCases: Array<{
		name: string;
		totalPaid: number;
		invoiceTotal: number;
		currentStatus: InvoiceStatus;
		expectedStatus: InvoiceStatus;
		expectedIsPaid: boolean;
	}> = [
		{
			name: "marks as paid when fully paid",
			totalPaid: 1000,
			invoiceTotal: 1000,
			currentStatus: "sent",
			expectedStatus: "paid",
			expectedIsPaid: true,
		},
		{
			name: "marks as paid when overpaid",
			totalPaid: 1100,
			invoiceTotal: 1000,
			currentStatus: "sent",
			expectedStatus: "paid",
			expectedIsPaid: true,
		},
		{
			name: "marks as partial when partially paid",
			totalPaid: 500,
			invoiceTotal: 1000,
			currentStatus: "sent",
			expectedStatus: "partial",
			expectedIsPaid: false,
		},
		{
			name: "keeps current status when no payment",
			totalPaid: 0,
			invoiceTotal: 1000,
			currentStatus: "sent",
			expectedStatus: "sent",
			expectedIsPaid: false,
		},
		{
			name: "changes from partial to paid when fully paid",
			totalPaid: 1000,
			invoiceTotal: 1000,
			currentStatus: "partial",
			expectedStatus: "paid",
			expectedIsPaid: true,
		},
		{
			name: "handles decimal amounts correctly",
			totalPaid: 999.99,
			invoiceTotal: 1000,
			currentStatus: "sent",
			expectedStatus: "partial",
			expectedIsPaid: false,
		},
		{
			name: "marks as paid at exact decimal match",
			totalPaid: 1234.56,
			invoiceTotal: 1234.56,
			currentStatus: "sent",
			expectedStatus: "paid",
			expectedIsPaid: true,
		},
	];

	it.each(testCases)("$name", ({
		totalPaid,
		invoiceTotal,
		currentStatus,
		expectedStatus,
		expectedIsPaid,
	}) => {
		const result = determineInvoiceStatus(
			totalPaid,
			invoiceTotal,
			currentStatus,
		);
		expect(result.newStatus).toBe(expectedStatus);
		expect(result.isPaid).toBe(expectedIsPaid);
	});
});
