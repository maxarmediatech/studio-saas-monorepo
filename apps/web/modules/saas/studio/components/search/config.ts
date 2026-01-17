import {
	CalendarIcon,
	CameraIcon,
	CheckSquareIcon,
	LayersIcon,
	PackageIcon,
	ReceiptIcon,
	UserIcon,
	UsersIcon,
	WalletIcon,
} from "lucide-react";
import type {
	EntityDisplayConfig,
	SearchEntityType,
	SearchResultItem,
	SearchResults,
	SearchTabConfig,
} from "./types";

// Tab configuration for the search filters
export const SEARCH_TABS: SearchTabConfig[] = [
	{ id: "all", label: "All", icon: LayersIcon },
	{
		id: "bookings",
		label: "Bookings",
		icon: CalendarIcon,
		countKey: "bookings",
	},
	{ id: "clients", label: "Clients", icon: UserIcon, countKey: "clients" },
	{ id: "crews", label: "Crew", icon: UsersIcon, countKey: "crews" },
	{ id: "shoots", label: "Shoots", icon: CameraIcon, countKey: "shoots" },
	{ id: "tasks", label: "Tasks", icon: CheckSquareIcon, countKey: "tasks" },
	{
		id: "deliverables",
		label: "Deliverables",
		icon: PackageIcon,
		countKey: "deliverables",
	},
	{
		id: "expenses",
		label: "Expenses",
		icon: WalletIcon,
		countKey: "expenses",
	},
	{
		id: "invoices",
		label: "Invoices",
		icon: ReceiptIcon,
		countKey: "invoices",
	},
];

// Entity display configuration for rendering results
export const ENTITY_DISPLAY_CONFIG: Record<
	keyof SearchResults,
	EntityDisplayConfig
> = {
	bookings: {
		icon: CalendarIcon,
		label: "Bookings",
		singularLabel: "booking",
		color: "text-blue-600",
		bgColor: "bg-blue-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || item.referenceNumber || "Untitled Booking",
		getSubtext: (item: SearchResultItem) =>
			item.name && item.referenceNumber
				? item.referenceNumber
				: undefined,
		route: "bookings",
	},
	clients: {
		icon: UserIcon,
		label: "Clients",
		singularLabel: "client",
		color: "text-green-600",
		bgColor: "bg-green-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || "Unnamed Client",
		getSubtext: (item: SearchResultItem) => item.email ?? undefined,
		route: "clients",
	},
	crews: {
		icon: UsersIcon,
		label: "Crew",
		singularLabel: "crew member",
		color: "text-purple-600",
		bgColor: "bg-purple-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || "Unnamed Crew Member",
		getSubtext: (item: SearchResultItem) => item.role,
		route: "crew",
	},
	shoots: {
		icon: CameraIcon,
		label: "Shoots",
		singularLabel: "shoot",
		color: "text-orange-600",
		bgColor: "bg-orange-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || item.referenceNumber || "Untitled Shoot",
		getSubtext: (item: SearchResultItem) =>
			item.name && item.referenceNumber
				? item.referenceNumber
				: undefined,
		route: "shoots",
	},
	tasks: {
		icon: CheckSquareIcon,
		label: "Tasks",
		singularLabel: "task",
		color: "text-yellow-600",
		bgColor: "bg-yellow-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || "Untitled Task",
		route: "tasks",
	},
	deliverables: {
		icon: PackageIcon,
		label: "Deliverables",
		singularLabel: "deliverable",
		color: "text-pink-600",
		bgColor: "bg-pink-50",
		getDisplayName: (item: SearchResultItem) =>
			item.name || "Untitled Deliverable",
		route: "deliverables",
	},
	expenses: {
		icon: WalletIcon,
		label: "Expenses",
		singularLabel: "expense",
		color: "text-red-600",
		bgColor: "bg-red-50",
		getDisplayName: (item: SearchResultItem) =>
			item.description || item.referenceNumber || "Untitled Expense",
		getSubtext: (item: SearchResultItem) =>
			item.description && item.referenceNumber
				? item.referenceNumber
				: undefined,
		route: "expenses",
	},
	invoices: {
		icon: ReceiptIcon,
		label: "Invoices",
		singularLabel: "invoice",
		color: "text-cyan-600",
		bgColor: "bg-cyan-50",
		getDisplayName: (item: SearchResultItem) =>
			item.invoiceNumber || "Untitled Invoice",
		route: "invoices",
	},
};

// Helper to get total result count
export function getTotalCount(results: SearchResults): number {
	return Object.values(results).reduce(
		(sum, arr) => sum + (arr?.length || 0),
		0,
	);
}

// Helper to get count for a specific entity type
export function getEntityCount(
	results: SearchResults,
	entityType: SearchEntityType,
): number {
	if (entityType === "all") {
		return getTotalCount(results);
	}
	return results[entityType]?.length || 0;
}
