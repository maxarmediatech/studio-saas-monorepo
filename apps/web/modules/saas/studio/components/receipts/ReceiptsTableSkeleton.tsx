"use client";

import { Skeleton } from "@repo/ui/components/skeleton";

export function ReceiptsTableSkeleton() {
	return (
		<div className="space-y-4">
			<div className="rounded-md border">
				<div className="border-b bg-muted/50 p-4">
					<div className="flex items-center gap-4">
						<Skeleton className="h-4 w-4" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-20" />
					</div>
				</div>
				{Array.from({ length: 10 }).map((_, i) => (
					<div key={i} className="border-b p-4 last:border-b-0">
						<div className="flex items-center gap-4">
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-20" />
						</div>
					</div>
				))}
			</div>
			<div className="flex items-center justify-between">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-8 w-32" />
			</div>
		</div>
	);
}
