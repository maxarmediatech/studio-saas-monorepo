import type { VisibilityState } from "@tanstack/react-table";

export const TABLE_EXPORT_ENTITIES = [
	"booking",
	"client",
	"configuration",
	"crew",
	"deliverable",
	"expense",
	"invoice",
	"payment",
	"receipt",
	"schedule",
	"shoot",
	"task",
] as const;

export type TableExportEntity = (typeof TABLE_EXPORT_ENTITIES)[number];

export const TABLE_EXPORT_FORMATS = ["csv", "zip"] as const;

export type TableExportFormat = (typeof TABLE_EXPORT_FORMATS)[number];

export interface TableExportRequest {
	entityType: TableExportEntity;
	format: TableExportFormat;
	input: Record<string, unknown>;
	columnVisibility?: VisibilityState | null;
}

export interface TableExportColumn<Row> {
	id: string;
	header: string;
	value: (row: Row) => unknown;
}

export interface TableExportPage<Row> {
	data: Row[];
	pagination: {
		pageCount: number;
		total: number;
	};
}
