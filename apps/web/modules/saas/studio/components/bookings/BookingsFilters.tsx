"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { SearchIcon } from "lucide-react";
import type { BookingPhase } from "@repo/api/modules/studio/schemas/common";

interface BookingsFiltersProps {
	organizationSlug: string;
	initialSearch?: string;
	initialStatus?: BookingPhase;
}

export function BookingsFilters({
	organizationSlug,
	initialSearch,
	initialStatus,
}: BookingsFiltersProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	const [searchValue, setSearchValue] = useState(initialSearch ?? "");
	const [currentStatus, setCurrentStatus] = useState<BookingPhase | "all">(
		initialStatus ?? "all",
	);

	const updateFilters = (search?: string, status?: BookingPhase | "all") => {
		const params = new URLSearchParams();
		if (search) {
			params.set("search", search);
		}
		if (status && status !== "all") {
			params.set("status", status);
		}

		const queryString = params.toString();
		const url = `/app/${organizationSlug}/bookings${queryString ? `?${queryString}` : ""}`;

		startTransition(() => {
			router.push(url, { scroll: false });
		});
	};

	const handleSearch = () => {
		updateFilters(searchValue || undefined, currentStatus);
	};

	const handleStatusChange = (value: string) => {
		const newStatus = value === "all" ? "all" : (value as BookingPhase);
		setCurrentStatus(newStatus);
		updateFilters(searchValue || undefined, newStatus);
	};

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
			<div className="relative flex-1 max-w-sm">
				<SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					placeholder="Search bookings..."
					value={searchValue}
					onChange={(e) => setSearchValue(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					className="pl-9"
					disabled={isPending}
				/>
			</div>

			<Select value={currentStatus} onValueChange={handleStatusChange}>
				<SelectTrigger className="w-40" disabled={isPending}>
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
