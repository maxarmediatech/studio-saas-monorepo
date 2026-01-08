import { Skeleton } from "@repo/ui/components/skeleton";

export function ConfigurationsTableSkeleton() {
	return (
		<div className="space-y-4">
			{/* Table skeleton */}
			<div className="rounded-md border">
				{/* Table header */}
				<div className="border-b bg-muted/50 p-4">
					<div className="flex items-center gap-4">
						<Skeleton className="h-4 w-32" /> {/* Label */}
						<Skeleton className="h-4 w-48" /> {/* Description */}
						<Skeleton className="h-4 w-16" /> {/* Order */}
						<Skeleton className="h-4 w-16" /> {/* Default */}
						<Skeleton className="h-4 w-16" /> {/* Type */}
						<Skeleton className="h-4 w-12" /> {/* Actions */}
					</div>
				</div>

				{/* Table rows */}
				{Array.from({ length: 8 }).map((_, i) => (
					<div key={i} className="border-b p-4 last:border-b-0">
						<div className="flex items-center gap-4">
							{/* Label column with color dot */}
							<div className="flex items-center gap-3 w-52">
								<Skeleton className="h-4 w-4 rounded-full" />
								<div className="space-y-1">
									<Skeleton className="h-4 w-24" />
									<Skeleton className="h-3 w-16" />
								</div>
							</div>
							{/* Description */}
							<Skeleton className="h-4 w-40" />
							{/* Order */}
							<Skeleton className="h-4 w-8" />
							{/* Default */}
							<Skeleton className="h-4 w-4" />
							{/* Type badge */}
							<Skeleton className="h-5 w-14 rounded-full" />
							{/* Actions */}
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
