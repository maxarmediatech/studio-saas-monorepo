"use client";

import { Checkbox } from "@repo/ui/components/checkbox";
import type { ColumnDef } from "@tanstack/react-table";

/**
 * Creates a select column for row selection in DataTable.
 *
 * Usage:
 * ```tsx
 * const columns = [
 *   createSelectColumn<MyDataType>(),
 *   // ... other columns
 * ];
 * ```
 */
export function createSelectColumn<TData>(): ColumnDef<TData> {
	return {
		id: "select",
		header: ({ table }) => (
			<div className="flex items-center justify-center">
				<Checkbox
					checked={
						table.getIsAllPageRowsSelected() ||
						(table.getIsSomePageRowsSelected() && "indeterminate")
					}
					onCheckedChange={(value) =>
						table.toggleAllPageRowsSelected(!!value)
					}
					aria-label="Select all"
				/>
			</div>
		),
		cell: ({ row }) => (
			<div className="flex items-center justify-center">
				<Checkbox
					checked={row.getIsSelected()}
					onCheckedChange={(value) => row.toggleSelected(!!value)}
					aria-label="Select row"
					onClick={(e) => e.stopPropagation()}
				/>
			</div>
		),
		enableSorting: false,
		enableHiding: false,
		meta: {
			width: 48,
			minWidth: 48,
			maxWidth: 48,
			headerClassName: "!px-0 !border-r-0 bg-gray-100 z-10",
			cellClassName:
				"!px-0 !border-r-0 bg-table-surface group-hover:bg-table-row-selected group-data-[state=selected]:bg-table-row-selected z-10",
		},
	};
}
