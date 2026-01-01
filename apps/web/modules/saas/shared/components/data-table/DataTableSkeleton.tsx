"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { TableCell, TableRow } from "@repo/ui/components/table";

interface DataTableSkeletonProps {
	columns: number;
	rows?: number;
}

export function DataTableSkeleton({
	columns,
	rows = 5,
}: DataTableSkeletonProps) {
	return (
		<>
			{Array.from({ length: rows }).map((_, rowIndex) => (
				<TableRow key={rowIndex}>
					{Array.from({ length: columns }).map((_, colIndex) => (
						<TableCell key={colIndex}>
							<Skeleton className="h-4 w-full max-w-[200px]" />
						</TableCell>
					))}
				</TableRow>
			))}
		</>
	);
}
