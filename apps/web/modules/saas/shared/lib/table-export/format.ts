import { strToU8, zipSync } from "fflate";
import type { TableExportColumn } from "./types";

function stringifyCell(value: unknown): string {
	if (value == null) {
		return "";
	}

	if (Array.isArray(value)) {
		return value
			.map((entry) => stringifyCell(entry))
			.filter(Boolean)
			.join(", ");
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "object") {
		return JSON.stringify(value);
	}

	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}

	return String(value);
}

export function csvEscape(value: unknown): string {
	const stringValue = stringifyCell(value);
	if (
		stringValue.includes(",") ||
		stringValue.includes('"') ||
		stringValue.includes("\n") ||
		stringValue.includes("\r")
	) {
		return `"${stringValue.replaceAll('"', '""')}"`;
	}
	return stringValue;
}

export function buildCsvContent<Row>(
	columns: TableExportColumn<Row>[],
	rows: Row[],
): string {
	const header = columns.map((column) => csvEscape(column.header)).join(",");
	const lines = rows.map((row) =>
		columns.map((column) => csvEscape(column.value(row))).join(","),
	);
	return [`\uFEFF${header}`, ...lines].join("\n");
}

export function resolveVisibleColumns<Row>(
	columns: TableExportColumn<Row>[],
	columnVisibility?: Record<string, boolean> | null,
): TableExportColumn<Row>[] {
	const visibleColumns = columns.filter(
		(column) => columnVisibility?.[column.id] !== false,
	);

	return visibleColumns.length > 0 ? visibleColumns : columns;
}

export function buildZipBuffer(filename: string, csvContent: string): Uint8Array {
	return zipSync({
		[filename]: strToU8(csvContent),
	});
}

export function formatDate(value: string | null | undefined): string {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleDateString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatDateTime(value: string | null | undefined): string {
	if (!value) {
		return "";
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return date.toLocaleString("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatMoneyValue(value: string | null | undefined): string {
	if (!value) {
		return "";
	}

	const amount = Number(value);
	if (Number.isNaN(amount)) {
		return value;
	}

	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
	}).format(amount);
}
