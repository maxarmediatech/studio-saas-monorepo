"use client";

import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { BookingDetailLayout } from "./BookingDetailLayout";
import { BookingDetailResponsiveGrid } from "./booking-detail-responsive-grid";
import { BookingDetailScrollArea } from "./booking-detail-scroll-area";

function HeaderSkeleton() {
	return (
		<div className="flex w-full items-center justify-between gap-4">
			<div className="flex min-w-0 items-center gap-2">
				<Skeleton className="h-4 w-20" />
				<Skeleton className="h-3 w-3 rounded-full" />
				<Skeleton className="h-4 w-24" />
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Skeleton className="h-8 w-8 rounded-md" />
				<Skeleton className="hidden h-8 w-8 rounded-md md:block" />
			</div>
		</div>
	);
}

function HeroSkeleton() {
	return (
		<section
			className="rounded-lg border bg-background p-6"
			data-testid="booking-detail-skeleton-hero"
		>
			<div className="space-y-4">
				<div className="flex items-start justify-between gap-4">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton className="h-5 w-20 rounded-full" />
						<Skeleton className="h-5 w-20 rounded-full" />
						<Skeleton className="h-4 w-28" />
					</div>
					<Skeleton className="h-8 w-16 rounded-md" />
				</div>

				<div className="space-y-2">
					<Skeleton className="h-8 w-56" />
					<Skeleton className="h-4 w-72 max-w-full" />
				</div>

				<div className="flex flex-wrap items-center gap-4">
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 w-44" />
				</div>

				<div className="flex flex-wrap gap-2">
					<Skeleton className="h-6 w-32 rounded-full" />
					<Skeleton className="h-6 w-36 rounded-full" />
				</div>

				<div className="flex flex-wrap items-center gap-2 pt-2">
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-32 rounded-md" />
					<Skeleton className="h-8 w-24 rounded-md" />
					<Skeleton className="h-8 w-28 rounded-md" />
				</div>
			</div>
		</section>
	);
}

function OverviewSkeleton() {
	return (
		<div
			className="space-y-6"
			data-testid="booking-detail-skeleton-tabs-content"
		>
			<Card className="rounded-lg shadow-none">
				<CardHeader className="space-y-2">
					<Skeleton className="h-5 w-40" />
					<Skeleton className="h-4 w-56 max-w-full" />
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, index) => (
							<div
								key={`summary-stat-${index}`}
								className="rounded-lg border bg-muted/20 p-3"
							>
								<Skeleton className="h-3 w-20" />
								<Skeleton className="mt-2 h-6 w-24" />
							</div>
						))}
					</div>
					<Skeleton className="h-2 w-full" />
				</CardContent>
			</Card>

			<Card className="rounded-lg shadow-none">
				<CardHeader className="space-y-2">
					<Skeleton className="h-5 w-28" />
					<Skeleton className="h-4 w-44 max-w-full" />
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div
							key={`task-row-${index}`}
							className="flex items-center justify-between rounded-lg border bg-muted/10 px-3 py-2"
						>
							<Skeleton className="h-4 w-40 max-w-[70%]" />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
					))}
				</CardContent>
			</Card>

			<Card className="rounded-lg shadow-none">
				<CardHeader className="space-y-2">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-40 max-w-full" />
				</CardHeader>
				<CardContent className="space-y-3">
					{Array.from({ length: 3 }).map((_, index) => (
						<div key={`finance-row-${index}`} className="space-y-2">
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-2 w-full" />
						</div>
					))}
				</CardContent>
			</Card>
		</div>
	);
}

function MetaPanelSkeleton() {
	return (
		<aside
			className="hidden space-y-6 lg:block"
			data-testid="booking-detail-skeleton-meta-panel"
		>
			{Array.from({ length: 4 }).map((_, index) => (
				<Card
					key={`meta-card-${index}`}
					className="rounded-lg shadow-none"
				>
					<CardHeader className="space-y-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-4 w-40 max-w-full" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-4 w-11/12" />
						<Skeleton className="h-4 w-2/3" />
					</CardContent>
				</Card>
			))}
		</aside>
	);
}

export function BookingDetailPageSkeleton() {
	return (
		<BookingDetailLayout header={<HeaderSkeleton />} rawContent>
			<BookingDetailScrollArea>
				<div
					className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8"
					data-testid="booking-detail-page-skeleton"
				>
					<div className="space-y-6">
						<HeroSkeleton />

						<BookingDetailResponsiveGrid>
							<div
								className="space-y-5"
								data-testid="booking-detail-skeleton-tabs"
							>
								<div className="space-y-4">
									<div className="flex w-full gap-2 overflow-x-auto">
										<Skeleton className="h-9 w-24 shrink-0 rounded-md" />
										<Skeleton className="h-9 w-24 shrink-0 rounded-md" />
										<Skeleton className="h-9 w-28 shrink-0 rounded-md" />
										<Skeleton className="h-9 w-24 shrink-0 rounded-md" />
									</div>
									<div className="pt-2">
										<OverviewSkeleton />
									</div>
								</div>
							</div>

							<MetaPanelSkeleton />
						</BookingDetailResponsiveGrid>
					</div>
				</div>
			</BookingDetailScrollArea>
		</BookingDetailLayout>
	);
}
