"use client";

import { Input } from "@repo/ui/components/input";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Skeleton } from "@repo/ui/components/skeleton";
import { bookingsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { BookingListItem } from "./BookingListItem";

interface BookingListSidebarProps {
	organizationSlug: string;
	currentBookingId: string;
}

export function BookingListSidebar({
	organizationSlug,
	currentBookingId,
}: BookingListSidebarProps) {
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const selectedRef = useRef<HTMLDivElement>(null);

	const debouncedSetSearch = useDebounceCallback((value: string) => {
		setDebouncedSearch(value);
	}, 300);

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearch(value);
		debouncedSetSearch(value);
	};

	const { data, isLoading } = useQuery({
		...bookingsApi.listMinimalOptions({
			search: debouncedSearch || undefined,
		}),
	});

	const bookings = useMemo(() => data?.data ?? [], [data]);

	useEffect(() => {
		if (selectedRef.current) {
			selectedRef.current.scrollIntoView({
				behavior: "instant",
				block: "center",
			});
		}
	}, [currentBookingId, bookings]);

	return (
		<div className="flex h-full flex-col">
			<div className="shrink-0 p-3 border-b">
				<div className="relative">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						type="text"
						placeholder="Search bookings..."
						value={search}
						onChange={handleSearchChange}
						className="pl-9 h-9 text-sm"
					/>
				</div>
			</div>

			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-1">
					{isLoading ? (
						<BookingListSkeleton />
					) : bookings.length === 0 ? (
						<EmptyState search={debouncedSearch} />
					) : (
						bookings.map((booking) => {
							const isSelected = booking.id === currentBookingId;
							return (
								<div
									key={booking.id}
									ref={isSelected ? selectedRef : undefined}
								>
									<BookingListItem
										booking={booking}
										isSelected={isSelected}
										organizationSlug={organizationSlug}
									/>
								</div>
							);
						})
					)}
				</div>
			</ScrollArea>

			{!isLoading && bookings.length > 0 && (
				<div className="shrink-0 px-3 py-2 border-t text-xs text-muted-foreground text-center">
					{bookings.length} booking{bookings.length !== 1 ? "s" : ""}
				</div>
			)}
		</div>
	);
}

function BookingListSkeleton() {
	return (
		<div className="space-y-2 p-1">
			{Array.from({ length: 8 }).map((_, i) => (
				<div key={i} className="px-3 py-3 space-y-2">
					<Skeleton className="h-4 w-3/4" />
					<div className="flex justify-between">
						<Skeleton className="h-3 w-20" />
						<Skeleton className="h-5 w-16 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}

function EmptyState({ search }: { search: string }) {
	return (
		<div className="flex flex-col items-center justify-center py-8 px-4 text-center">
			<p className="text-sm text-muted-foreground">
				{search
					? `No bookings found for "${search}"`
					: "No bookings yet"}
			</p>
		</div>
	);
}
