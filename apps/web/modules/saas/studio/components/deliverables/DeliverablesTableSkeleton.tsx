import { Skeleton } from "@repo/ui/components/skeleton";

export function DeliverablesTableSkeleton() {
	return (
		<div className="space-y-4">
			{/* Table skeleton */}
			<div className="rounded-md border">
				{/* Table header */}
				<div className="border-b bg-muted/50 p-4">
					<div className="flex items-center gap-4">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-12" />
					</div>
				</div>

				{/* Table rows */}
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="border-b p-4 last:border-b-0">
						<div className="flex items-center gap-4">
							<Skeleton className="h-4 w-16" />
							<div className="flex flex-col gap-1">
								<Skeleton className="h-4 w-32" />
								<Skeleton className="h-3 w-20" />
							</div>
							<Skeleton className="h-6 w-20 rounded-full" />
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-4 w-12" />
							<Skeleton className="ml-auto h-8 w-8" />
						</div>
					</div>
				))}
			</div>

			{/* Pagination skeleton */}
			<div className="flex items-center justify-between">
				<Skeleton className="h-4 w-32" />
				<div className="flex items-center gap-2">
					<Skeleton className="h-8 w-8" />
					<Skeleton className="h-8 w-8" />
					<Skeleton className="h-8 w-8" />
				</div>
			</div>
		</div>
	);
}
