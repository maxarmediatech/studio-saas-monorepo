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
			<Checkbox
				checked={
					table.getIsAllPageRowsSelected() ||
					(table.getIsSomePageRowsSelected() && "indeterminate")
				}
				onCheckedChange={(value) =>
					table.toggleAllPageRowsSelected(!!value)
				}
				aria-label="Select all"
				className="translate-y-[2px]"
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => row.toggleSelected(!!value)}
				aria-label="Select row"
				className="translate-y-[2px]"
				onClick={(e) => e.stopPropagation()}
			/>
		),
		enableSorting: false,
		enableHiding: false,
		meta: {
			width: 56,
			minWidth: 56,
			headerClassName:
				"text-center bg-background z-10 before:absolute before:right-0 before:top-0 before:bottom-0 before:w-px before:bg-border",
			cellClassName:
				"text-center bg-background z-10 before:absolute before:right-0 before:top-0 before:bottom-0 before:w-px before:bg-border",
		},
	};
}
