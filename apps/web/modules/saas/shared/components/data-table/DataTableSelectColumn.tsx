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
			width: 56,
			minWidth: 56,
			headerClassName: "!px-0 !border-r-0 bg-background z-10",
			cellClassName: "!px-0 !border-r-0 bg-background z-10",
		},
	};
}
