import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import {
	buildCsvContent,
	buildZipBuffer,
	resolveVisibleColumns,
} from "../modules/saas/shared/lib/table-export/format";
import type { TableExportColumn } from "../modules/saas/shared/lib/table-export/types";

type SampleRow = {
	name: string;
	email: string;
	notes: string;
};

const sampleColumns: TableExportColumn<SampleRow>[] = [
	{
		id: "name",
		header: "Name",
		value: (row) => row.name,
	},
	{
		id: "email",
		header: "Email",
		value: (row) => row.email,
	},
	{
		id: "notes",
		header: "Notes",
		value: (row) => row.notes,
	},
];

test.describe("table export helpers", () => {
	test("builds csv with escaped cells", () => {
		const csv = buildCsvContent(sampleColumns, [
			{
				name: 'Rakesh "RK"',
				email: "rk@example.com",
				notes: "line 1,\nline 2",
			},
		]);

		expect(csv).toBe(
			'\uFEFFName,Email,Notes\n"Rakesh ""RK""",rk@example.com,"line 1,\nline 2"',
		);
	});

	test("exports only visible columns", () => {
		const visibleColumns = resolveVisibleColumns(sampleColumns, {
			email: false,
		});

		expect(visibleColumns.map((column) => column.id)).toEqual([
			"name",
			"notes",
		]);
	});

	test("falls back to all columns when all are hidden", () => {
		const visibleColumns = resolveVisibleColumns(sampleColumns, {
			name: false,
			email: false,
			notes: false,
		});

		expect(visibleColumns).toEqual(sampleColumns);
	});

	test("wraps csv content in a zip", () => {
		const csv = buildCsvContent(sampleColumns.slice(0, 2), [
			{
				name: "Rakesh",
				email: "rk@example.com",
				notes: "",
			},
		]);
		const archive = buildZipBuffer("clients-export.csv", csv);
		const files = unzipSync(archive);

		expect(Buffer.from(files["clients-export.csv"]).toString("utf8")).toBe(
			csv,
		);
	});
});
