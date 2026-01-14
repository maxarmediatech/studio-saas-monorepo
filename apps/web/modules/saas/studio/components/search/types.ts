import type { LucideIcon } from "lucide-react";

export type SearchEntityType =
	| "all"
	| "bookings"
	| "clients"
	| "crews"
	| "shoots"
	| "tasks"
	| "deliverables"
	| "expenses"
	| "invoices";

export interface SearchResultItem {
	id: string;
	name?: string;
	description?: string;
	referenceNumber?: string;
	email?: string | null;
	role?: string;
	invoiceNumber?: string;
	status?: string;
	amount?: string;
	totalAmount?: string;
	shootType?: string;
	shootDate?: string;
	dueDate?: string | null;
	category?: string | null;
	expenseDate?: string;
	bookingId?: string;
	phoneNumber?: string | null;
}

export interface SearchResults {
	bookings: SearchResultItem[];
	clients: SearchResultItem[];
	crews: SearchResultItem[];
	shoots: SearchResultItem[];
	tasks: SearchResultItem[];
	deliverables: SearchResultItem[];
	expenses: SearchResultItem[];
	invoices: SearchResultItem[];
}

export interface SearchTabConfig {
	id: SearchEntityType;
	label: string;
	icon: LucideIcon;
	countKey?: keyof SearchResults;
}

export interface EntityDisplayConfig {
	icon: LucideIcon;
	label: string;
	singularLabel: string;
	color: string;
	bgColor: string;
	getDisplayName: (item: SearchResultItem) => string;
	getSubtext?: (item: SearchResultItem) => string | undefined;
	route: string;
}
