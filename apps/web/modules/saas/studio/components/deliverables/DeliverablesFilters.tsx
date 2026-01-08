"use client";

import {
	DataTableToolbar,
	type ToolbarFilterConfig,
} from "@saas/shared/components/data-table";
import { useDeliverablesTable } from "@saas/studio/hooks/tables";
import {
	AlertCircleIcon,
	CircleIcon,
	TagIcon,
} from "lucide-react";
import { useMemo } from "react";

/**
 * Deliverable type options for the type filter.
 */
const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
	wedding_album: "Wedding Album",
	pre_wedding_album: "Pre-Wedding Album",
	photo_album: "Photo Album",
	highlight_video: "Highlight Video",
	full_video: "Full Video",
	teaser: "Teaser",
	reel: "Reel",
	edited_photos: "Edited Photos",
	raw_photos: "Raw Photos",
	raw_videos: "Raw Videos",
	drone_footage: "Drone Footage",
	frame: "Frame",
	canvas: "Canvas",
	other: "Other",
};

const DELIVERABLE_TYPE_OPTIONS = [
	{ value: "wedding_album", label: "Wedding Album" },
	{ value: "pre_wedding_album", label: "Pre-Wedding Album" },
	{ value: "photo_album", label: "Photo Album" },
	{ value: "highlight_video", label: "Highlight Video" },
	{ value: "full_video", label: "Full Video" },
	{ value: "teaser", label: "Teaser" },
	{ value: "reel", label: "Reel" },
	{ value: "edited_photos", label: "Edited Photos" },
	{ value: "raw_photos", label: "Raw Photos" },
	{ value: "raw_videos", label: "Raw Videos" },
	{ value: "drone_footage", label: "Drone Footage" },
	{ value: "frame", label: "Frame" },
	{ value: "canvas", label: "Canvas" },
	{ value: "other", label: "Other" },
];

/**
 * Status options for the status filter.
 */
const STATUS_OPTIONS = [
	{
		label: "Pending",
		value: "pending",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-gray-400 text-gray-400`}
			/>
		),
	},
	{
		label: "In Progress",
		value: "in_progress",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-blue-400 text-blue-400`}
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
		label: "Delivered",
		value: "delivered",
		icon: ({ className }: { className?: string }) => (
			<CircleIcon
				className={`${className} fill-purple-400 text-purple-400`}
			/>
		),
	},
];

/**
 * Priority options for the priority filter.
 */
const PRIORITY_OPTIONS = [
	{
		label: "Low",
		value: "low",
		icon: ({ className }: { className?: string }) => (
			<AlertCircleIcon
				className={`${className} text-gray-400`}
			/>
		),
	},
	{
		label: "Medium",
		value: "medium",
		icon: ({ className }: { className?: string }) => (
			<AlertCircleIcon
				className={`${className} text-yellow-400`}
			/>
		),
	},
	{
		label: "High",
		value: "high",
		icon: ({ className }: { className?: string }) => (
			<AlertCircleIcon
				className={`${className} text-red-400`}
			/>
		),
	},
];

export function DeliverablesFilters() {
	// Use the deliverables table hook for URL-synced state
	const { filters, setFilter, resetFilters, isFiltered } = useDeliverablesTable();

	// Define filter configurations
	const filterConfigs: ToolbarFilterConfig[] = useMemo(
		() => [
			{
				id: "deliverableType",
				label: "Type",
				variant: "multiSelect",
				icon: TagIcon,
				options: DELIVERABLE_TYPE_OPTIONS,
			},
			{
				id: "status",
				label: "Status",
				variant: "multiSelect",
				options: STATUS_OPTIONS,
			},
			{
				id: "priority",
				label: "Priority",
				variant: "multiSelect",
				options: PRIORITY_OPTIONS,
			},
		],
		[],
	);

	// Convert filters to toolbar format
	const filterValues = useMemo(
		() => ({
			deliverableType: filters.deliverableType ?? [],
			status: filters.status ?? [],
			priority: filters.priority ?? [],
		}),
		[
			filters.deliverableType,
			filters.status,
			filters.priority,
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
		if (filterId === "deliverableType") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("deliverableType", values);
		} else if (filterId === "status") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("status", values);
		} else if (filterId === "priority") {
			const values =
				Array.isArray(value) && value.length > 0 ? value : null;
			setFilter("priority", values);
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
			searchPlaceholder="Search deliverables..."
			onSearchChange={handleSearchChange}
			showViewOptions={false}
		/>
	);
}
