import type { LucideIcon } from "lucide-react";

export interface EntityConfig {
	icon: LucideIcon;
	label: string;
	color: string;
	bgColor: string;
	singularLabel: string;
}

// Search result types (matching API response)
export interface BookingSearchResult {
	id: string;
	name: string;
	referenceNumber: string;
	status: string;
}

export interface ClientSearchResult {
	id: string;
	name: string;
	email: string | null;
	phoneNumber: string | null;
}

export interface CrewSearchResult {
	id: string;
	name: string;
	role: string;
	email: string | null;
}

export interface ShootSearchResult {
	id: string;
	name: string;
	shootType: string;
	shootDate: string;
	bookingId: string;
}

export interface TaskSearchResult {
	id: string;
	name: string;
	status: string;
	dueDate: string | null;
	bookingId: string;
}

export interface DeliverableSearchResult {
	id: string;
	name: string;
	status: string;
	dueDate: string | null;
	bookingId: string;
}

export interface ExpenseSearchResult {
	id: string;
	description: string;
	amount: string;
	expenseDate: string;
	category: string | null;
}

export interface InvoiceSearchResult {
	id: string;
	invoiceNumber: string;
	status: string;
	totalAmount: string;
	bookingId: string;
}

export interface GlobalSearchResponse {
	bookings: BookingSearchResult[];
	clients: ClientSearchResult[];
	crews: CrewSearchResult[];
	shoots: ShootSearchResult[];
	tasks: TaskSearchResult[];
	deliverables: DeliverableSearchResult[];
	expenses: ExpenseSearchResult[];
	invoices: InvoiceSearchResult[];
}
