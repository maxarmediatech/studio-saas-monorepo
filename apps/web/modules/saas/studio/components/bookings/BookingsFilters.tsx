"use client";

import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { useBookingsTable } from "@saas/studio/hooks/tables";
import { SearchIcon } from "lucide-react";
import { useState } from "react";

export function BookingsFilters() {
	// Use the bookings table hook for URL-synced state
	const { filters, setFilter, isFiltered } = useBookingsTable();

	// Local state for search input (immediate updates, debounced sync)
	const [searchInput, setSearchInput] = useState(filters.search ?? "");

	const handleSearchChange = (value: string) => {
		setSearchInput(value);
		setFilter("search", value || null);
	};

	const handleStatusChange = (value: string) => {
		const newStatus =
			value === "all" ? null : (value as BookingPhase);
		setFilter("status", newStatus);
	};

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
			<div className="relative flex-1 max-w-sm">
				<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search bookings..."
					value={searchInput}
					onChange={(e) => handleSearchChange(e.target.value)}
					className="pl-9"
				/>
			</div>

			<Select
				value={filters.status ?? "all"}
				onValueChange={handleStatusChange}
			>
				<SelectTrigger className="w-40">
					<SelectValue placeholder="All statuses" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">All statuses</SelectItem>
					<SelectItem value="new">New</SelectItem>
					<SelectItem value="preparation">Preparation</SelectItem>
					<SelectItem value="shooting">Shooting</SelectItem>
					<SelectItem value="delivery">Delivery</SelectItem>
					<SelectItem value="completed">Completed</SelectItem>
					<SelectItem value="cancelled">Cancelled</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
