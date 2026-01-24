"use client";

import { Skeleton } from "@repo/ui/components/skeleton";

export function DashboardSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<Skeleton className="h-10 w-64" />
				<div className="flex gap-2">
					<Skeleton className="h-9 w-48" />
					<Skeleton className="h-9 w-9" />
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-24 rounded-lg" />
				))}
			</div>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<Skeleton key={i} className="h-20 rounded-lg" />
				))}
			</div>

			<Skeleton className="h-48 rounded-lg" />

			<div className="grid gap-4 md:grid-cols-2">
				<Skeleton className="h-64 rounded-lg" />
				<Skeleton className="h-64 rounded-lg" />
			</div>
		</div>
	);
}
