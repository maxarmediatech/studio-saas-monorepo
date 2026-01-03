"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useBookingsTable } from "@saas/studio/hooks/tables";
import { configurationsApi } from "@saas/studio/lib/api";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, CircleIcon, PackageIcon, TagIcon } from "lucide-react";
import { useMemo } from "react";

/**
 * Status options for the booking status filter.
 * These are static since booking phases are system-defined.
 */
const STATUS_OPTIONS = [
	{
		label: "New",
		value: "new",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-yellow-400 text-yellow-400`}
			/>
		),
	},
	{
		label: "Preparation",
		value: "preparation",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-blue-400 text-blue-400`}
			/>
		),
	},
	{
		label: "Shooting",
		value: "shooting",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-purple-400 text-purple-400`}
			/>
		),
	},
	{
		label: "Delivery",
		value: "delivery",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-orange-400 text-orange-400`}
			/>
		),
	},
	{
		label: "Completed",
		value: "completed",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-green-400 text-green-400`}
			/>
		),
	},
	{
		label: "Cancelled",
		value: "cancelled",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-gray-400 text-gray-400`}
			/>
		),
	},
];

export function BookingsFilters() {
	// Use the bookings table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useBookingsTable();

	// Fetch configurations for dynamic filter options
	const { data: bookingTypesData } = useQuery(
		configurationsApi.bookingTypesOptions(),
	);
	const { data: packageTypesData } = useQuery(
		configurationsApi.packageTypesOptions(),
	);

	// Define filter configurations
	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "statuses",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			{
				id: "bookingType",
				label: "Booking Type",
				variant: "multiSelect",
				icon: TagIcon,
				options: (bookingTypesData?.data ?? []).map((c) => ({
					value: c.key,
					label: c.label,
				})),
			},
			{
				id: "packageType",
				label: "Package",
				variant: "multiSelect",
				icon: PackageIcon,
				options: (packageTypesData?.data ?? []).map((c) => ({
					value: c.key,
					label: c.label,
				})),
			},
			{
				id: "createdAt",
				label: "Date",
				variant: "dateRange",
				icon: CalendarIcon,
			},
		],
		[bookingTypesData, packageTypesData],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			statuses: filters.statuses ?? [],
			bookingType: filters.bookingType ?? [],
			packageType: filters.packageType ?? [],
			// Convert array [from, to] to { from, to } object for dateRange filter
			createdAt:
				filters.createdAt && filters.createdAt.length > 0
					? {
							from: filters.createdAt[0] ?? undefined,
							to: filters.createdAt[1] ?? undefined,
						}
					: null,
		}),
		[
			filters.statuses,
			filters.bookingType,
			filters.packageType,
			filters.createdAt,
		],
	);

	// Handle filter changes
	const handleFilterChange = (
		filterId: string,
		value:
			| string
			| string[]
			| { from?: string; to?: string }
			| null
			| undefined,
	) => {
		if (filterId === "statuses") {
			const statusValues =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("statuses", statusValues as typeof filters.statuses);
		} else if (filterId === "bookingType") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("bookingType", values);
		} else if (filterId === "packageType") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("packageType", values);
		} else if (filterId === "createdAt") {
			// DataTableDateFilter returns { from?: string, to?: string } or null
			if (value && typeof value === "object" && !Array.isArray(value)) {
				const dateRange = value as { from?: string; to?: string };
				const dates = [dateRange.from, dateRange.to].filter(
					(d): d is string => !!d,
				);
				setFilter("createdAt", dates.length > 0 ? dates : null);
			} else {
				setFilter("createdAt", null);
			}
		}
	};

	// Handle search changes
	const handleSearchChange = (value: string) => {
		setFilter("search", value || null);
	};

	return (
		<DataTableToolbar
			filters={filterConfigs}
			filterValues={filterValues}
			onFilterChange={handleFilterChange}
			onResetFilters={resetFilters}
			isFiltered={isFiltered}
			showSearch
			searchValue={filters.search ?? ""}
			searchPlaceholder="Search bookings..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
