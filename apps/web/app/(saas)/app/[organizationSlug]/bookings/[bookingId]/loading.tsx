import { Card, CardContent } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";

export default function BookingDetailLoading() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			{/* Header skeleton - matches PageContent header */}
			<div className="shrink-0 border-b border-neutral-200">
				<div className="mx-auto w-full max-w-screen-xl px-4 lg:px-6">
					<div className="flex h-12 items-center gap-2 sm:h-16">
						{/* Back button skeleton */}
						<Skeleton className="h-8 w-8 rounded-lg" />
						{/* Title + badge skeleton */}
						<div className="flex items-center gap-3">
							<Skeleton className="h-6 w-48" />
							<Skeleton className="h-5 w-20 rounded-full" />
						</div>
					</div>
				</div>
			</div>

			{/* Content area - matches PageContent content */}
			<div className="min-h-0 flex-1 overflow-y-auto pt-4 lg:pt-6">
				<div className="mx-auto w-full max-w-screen-xl px-4 lg:px-6">
					<div className="space-y-6 pb-8">
						{/* Hero Card - Package Cost, Received, Balance */}
						<Card>
							<CardContent className="pt-6">
								<div className="grid grid-cols-3 gap-4">
									{[1, 2, 3].map((i) => (
										<div key={i} className="space-y-2">
											<Skeleton className="h-4 w-20" />
											<Skeleton className="h-8 w-28" />
										</div>
									))}
								</div>
							</CardContent>
						</Card>

						{/* Accordion Sections */}
						<div className="space-y-3">
							{["Overview", "Shoots", "Deliverables", "Payments"].map(
								(section) => (
									<div
										key={section}
										className="overflow-hidden rounded-lg border bg-muted/10"
									>
										<div className="flex items-center px-4 py-3">
											<div className="flex items-center gap-2">
												<Skeleton className="h-4 w-4" />
												<Skeleton className="h-4 w-4" />
											</div>
											<div className="ml-2 flex flex-col gap-1">
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-3 w-32" />
											</div>
											<Skeleton className="ml-auto h-7 w-14" />
										</div>
									</div>
								),
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
