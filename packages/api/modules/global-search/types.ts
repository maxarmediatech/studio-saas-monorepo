// ============================================================================
// ENTITY TYPES
// ============================================================================

export const SEARCH_ENTITY_TYPES = [
	"booking",
	"client",
	"crew",
	"shoot",
	"task",
	"deliverable",
	"expense",
	"invoice",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

// ============================================================================
// SEARCH RESULT TYPES
// ============================================================================

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

// ============================================================================
// GROUPED RESPONSE
// ============================================================================

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

// ============================================================================
// REQUEST TYPES
// ============================================================================

export interface GlobalSearchInput {
	query: string;
	entities?: SearchEntityType[];
	limit?: number;
}

export interface EntitySearchInput {
	query: string;
	entityType: SearchEntityType;
	limit?: number;
}
