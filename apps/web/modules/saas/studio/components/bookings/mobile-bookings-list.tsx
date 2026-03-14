"use client";

import type { BookingListItem } from "@repo/api/modules/studio/schemas/booking";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
	DataTableRowActions,
	type PaginationState,
	type RowAction,
} from "@saas/shared/components/data-table";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";

interface MobileBookingsListProps {
	bookings: BookingListItem[];
	organizationSlug: string;
	rowActions: RowAction<BookingListItem>[];
	isLoading: boolean;
	isFetching: boolean;
	pagination: PaginationState;
	onPaginationChange?: (pagination: PaginationState) => void;
}

export function MobileBookingsList({
	bookings,
	organizationSlug,
	rowActions,
	isLoading,
	isFetching,
	pagination,
	onPaginationChange,
}: MobileBookingsListProps) {
	if (isLoading) {
		return (
			<div
				className="space-y-3 md:hidden"
				data-testid="booking-mobile-list"
			>
				{Array.from({ length: 4 }).map((_, index) => (
					<div
						key={index}
						className="border-b border-border/70 px-4 py-4 last:border-b-0"
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<Skeleton className="h-5 w-3/4" />
								<Skeleton className="mt-2 h-4 w-28" />
							</div>
							<Skeleton className="h-8 w-8 rounded-md" />
						</div>
					</div>
				))}
			</div>
		);
	}

	if (bookings.length === 0) {
		return (
			<div
				className="border-t border-border/70 px-4 py-8 text-center md:hidden"
				data-testid="booking-mobile-list"
			>
				<p className="text-sm font-medium text-foreground">
					No bookings found
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					Try another view or create a new booking.
				</p>
				<Button className="mt-4 h-10 w-full" asChild>
					<Link
						href={`/app/${organizationSlug}/bookings/new/details`}
					>
						Create booking
					</Link>
				</Button>
			</div>
		);
	}

	const canGoPrevious = pagination.page > 1;
	const canGoNext = pagination.page < pagination.pageCount;
	const startItem = (pagination.page - 1) * pagination.limit + 1;
	const endItem = Math.min(
		pagination.page * pagination.limit,
		pagination.total,
	);

	const handlePageChange = (page: number) => {
		onPaginationChange?.({
			...pagination,
			page,
		});
	};

	return (
		<div className="space-y-3 md:hidden" data-testid="booking-mobile-list">
			<div
				className={cn(
					"overflow-hidden border-t border-border/70 bg-white",
					isFetching && "opacity-70",
				)}
			>
				{bookings.map((booking) => {
					return (
						<article
							key={booking.id}
							className="relative border-b border-border/70 bg-white last:border-b-0"
							data-testid="booking-mobile-card"
						>
							<div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">
								<DataTableRowActions
									row={booking}
									actions={rowActions}
								/>
							</div>
							<Link
								href={`/app/${organizationSlug}/bookings/${booking.id}`}
								className="block min-w-0 px-4 py-4 pr-14"
							>
								<h3 className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">
									{booking.name}
								</h3>
								<p className="mt-1 truncate font-mono text-xs text-muted-foreground">
									{booking.referenceNumber}
								</p>
							</Link>
						</article>
					);
				})}
			</div>

			<div className="border-t border-border/70 px-4 py-4">
				<p className="text-sm text-muted-foreground">
					Showing {startItem} to {endItem} of {pagination.total}
				</p>
				<div className="mt-3 flex items-center gap-2">
					<Button
						variant="outline"
						className="h-10 flex-1 rounded-xl"
						onClick={() => handlePageChange(pagination.page - 1)}
						disabled={!canGoPrevious || isFetching}
					>
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<ChevronLeftIcon className="size-4" />
						)}
						Previous
					</Button>
					<div className="min-w-[4.5rem] text-center text-sm font-medium text-foreground">
						{pagination.page}/{pagination.pageCount}
					</div>
					<Button
						variant="outline"
						className="h-10 flex-1 rounded-xl"
						onClick={() => handlePageChange(pagination.page + 1)}
						disabled={!canGoNext || isFetching}
					>
						Next
						{isFetching ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : (
							<ChevronRightIcon className="size-4" />
						)}
					</Button>
				</div>
			</div>
		</div>
	);
}
