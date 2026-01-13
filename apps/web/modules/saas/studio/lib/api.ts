/**
 * Studio API Utilities
 *
 * Query hooks and mutation options for studio modules using ORPC + TanStack Query.
 * These utilities integrate with the @repo/api package.
 */

import { orpc } from "@shared/lib/orpc-query-utils";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const studioQueryKeys = {
	// Bookings
	bookings: {
		all: ["studio", "bookings"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "bookings", "list", filters] as const,
		detail: (id: string) => ["studio", "bookings", "detail", id] as const,
		stats: () => ["studio", "bookings", "stats"] as const,
		participants: (bookingId: string) =>
			["studio", "bookings", bookingId, "participants"] as const,
	},
	// Clients
	clients: {
		all: ["studio", "clients"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "clients", "list", filters] as const,
		detail: (id: string) => ["studio", "clients", "detail", id] as const,
	},
	// Crews
	crews: {
		all: ["studio", "crews"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "crews", "list", filters] as const,
		detail: (id: string) => ["studio", "crews", "detail", id] as const,
	},
	// Shoots
	shoots: {
		all: ["studio", "shoots"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "shoots", "list", filters] as const,
		detail: (id: string) => ["studio", "shoots", "detail", id] as const,
	},
	// Tasks
	tasks: {
		all: ["studio", "tasks"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "tasks", "list", filters] as const,
		detail: (id: string) => ["studio", "tasks", "detail", id] as const,
	},
	// Deliverables
	deliverables: {
		all: ["studio", "deliverables"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "deliverables", "list", filters] as const,
		detail: (id: string) =>
			["studio", "deliverables", "detail", id] as const,
	},
	// Payments (studio payments - received amounts)
	payments: {
		all: ["studio", "payments"] as const,
		received: {
			list: (filters?: Record<string, unknown>) =>
				["studio", "payments", "received", "list", filters] as const,
			detail: (id: string) =>
				["studio", "payments", "received", "detail", id] as const,
		},
		schedules: {
			list: (filters?: Record<string, unknown>) =>
				["studio", "payments", "schedules", "list", filters] as const,
			detail: (id: string) =>
				["studio", "payments", "schedules", "detail", id] as const,
		},
	},
	// Expenses
	expenses: {
		all: ["studio", "expenses"] as const,
		list: (filters?: Record<string, unknown>) =>
			["studio", "expenses", "list", filters] as const,
		detail: (id: string) => ["studio", "expenses", "detail", id] as const,
	},
} as const;

// ============================================================================
// BOOKINGS QUERY OPTIONS
// ============================================================================

export const bookingsApi = {
	// List bookings
	listOptions: (
		input?: Parameters<typeof orpc.bookings.list.queryOptions>[0]["input"],
	) => orpc.bookings.list.queryOptions({ input: input ?? {} }),

	// List minimal bookings (for dropdowns)
	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.bookings.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.bookings.listMinimal.queryOptions({ input: input ?? {} }),

	// Get single booking
	getOptions: (id: string) =>
		orpc.bookings.get.queryOptions({ input: { id } }),

	// Get booking stats
	statsOptions: () => orpc.bookings.stats.queryOptions({ input: {} }),

	// List participants
	listParticipantsOptions: (bookingId: string) =>
		orpc.bookings.listParticipants.queryOptions({ input: { bookingId } }),
};

// ============================================================================
// BOOKINGS MUTATION OPTIONS
// ============================================================================

export const bookingsMutations = {
	create: () => orpc.bookings.create.mutationOptions(),
	update: () => orpc.bookings.update.mutationOptions(),
	delete: () => orpc.bookings.delete.mutationOptions(),
	updateStatus: () => orpc.bookings.updateStatus.mutationOptions(),
	addParticipant: () => orpc.bookings.addParticipant.mutationOptions(),
	updateParticipant: () => orpc.bookings.updateParticipant.mutationOptions(),
	removeParticipant: () => orpc.bookings.removeParticipant.mutationOptions(),
};

// ============================================================================
// CLIENTS QUERY OPTIONS
// ============================================================================

export const clientsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.clients.list.queryOptions>[0]["input"],
	) => orpc.clients.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.clients.get.queryOptions({ input: { id } }),

	statsOptions: () => orpc.clients.stats.queryOptions({ input: {} }),
};

export const clientsMutations = {
	create: () => orpc.clients.create.mutationOptions(),
	update: () => orpc.clients.update.mutationOptions(),
	delete: () => orpc.clients.delete.mutationOptions(),
};

// ============================================================================
// CREWS QUERY OPTIONS
// ============================================================================

export const crewsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.crews.list.queryOptions>[0]["input"],
	) => orpc.crews.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.crews.get.queryOptions({ input: { id } }),

	availabilityOptions: (
		input: Parameters<
			typeof orpc.crews.availability.queryOptions
		>[0]["input"],
	) => orpc.crews.availability.queryOptions({ input }),
};

export const crewsMutations = {
	create: () => orpc.crews.create.mutationOptions(),
	update: () => orpc.crews.update.mutationOptions(),
	delete: () => orpc.crews.delete.mutationOptions(),
	createFromMember: () => orpc.crews.createFromMember.mutationOptions(),
};

// ============================================================================
// SHOOTS QUERY OPTIONS
// ============================================================================

export const shootsApi = {
	listOptions: (
		input?: Parameters<typeof orpc.shoots.list.queryOptions>[0]["input"],
	) => orpc.shoots.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.shoots.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.shoots.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.shoots.get.queryOptions({ input: { id } }),
};

export const shootsMutations = {
	create: () => orpc.shoots.create.mutationOptions(),
	update: () => orpc.shoots.update.mutationOptions(),
	delete: () => orpc.shoots.delete.mutationOptions(),
	assignCrew: () => orpc.shoots.assign.mutationOptions(),
	unassignCrew: () => orpc.shoots.unassign.mutationOptions(),
};

// ============================================================================
// CONFIGURATIONS QUERY OPTIONS
// ============================================================================

export const configurationsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.configurations.list.queryOptions
		>[0]["input"],
	) => orpc.configurations.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.configurations.get.queryOptions({ input: { id } }),

	// Convenience helpers for specific config types
	bookingTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "booking_type" },
		}),

	packageTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "package_type" },
		}),

	relationTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "relation_type" },
		}),

	shootStatusOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "shoot_status" },
		}),

	crewRolesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "crew_role" },
		}),

	eventTypesOptions: () =>
		orpc.configurations.list.queryOptions({
			input: { type: "event_type" },
		}),
};

export const configurationsMutations = {
	create: () => orpc.configurations.create.mutationOptions(),
	update: () => orpc.configurations.update.mutationOptions(),
	delete: () => orpc.configurations.delete.mutationOptions(),
	seed: () => orpc.configurations.seed.mutationOptions(),
};

// ============================================================================
// TASKS QUERY OPTIONS
// ============================================================================

export const tasksApi = {
	listOptions: (
		input?: Parameters<typeof orpc.tasks.list.queryOptions>[0]["input"],
	) => orpc.tasks.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) => orpc.tasks.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<typeof orpc.tasks.stats.queryOptions>[0]["input"],
	) => orpc.tasks.stats.queryOptions({ input: input ?? {} }),
};

export const tasksMutations = {
	create: () => orpc.tasks.create.mutationOptions(),
	update: () => orpc.tasks.update.mutationOptions(),
	delete: () => orpc.tasks.delete.mutationOptions(),
	updateStatus: () => orpc.tasks.updateStatus.mutationOptions(),
	assign: () => orpc.tasks.assign.mutationOptions(),
	unassign: () => orpc.tasks.unassign.mutationOptions(),
	submit: () => orpc.tasks.submit.mutationOptions(),
};

// ============================================================================
// DELIVERABLES QUERY OPTIONS
// ============================================================================

export const deliverablesApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.deliverables.list.queryOptions
		>[0]["input"],
	) => orpc.deliverables.list.queryOptions({ input: input ?? {} }),

	listMinimalOptions: (
		input?: Parameters<
			typeof orpc.deliverables.listMinimal.queryOptions
		>[0]["input"],
	) => orpc.deliverables.listMinimal.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.deliverables.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<
			typeof orpc.deliverables.stats.queryOptions
		>[0]["input"],
	) => orpc.deliverables.stats.queryOptions({ input: input ?? {} }),
};

export const deliverablesMutations = {
	create: () => orpc.deliverables.create.mutationOptions(),
	update: () => orpc.deliverables.update.mutationOptions(),
	delete: () => orpc.deliverables.delete.mutationOptions(),
	assign: () => orpc.deliverables.assign.mutationOptions(),
	unassign: () => orpc.deliverables.unassign.mutationOptions(),
	convertToTask: () => orpc.deliverables.convertToTask.mutationOptions(),
	submit: () => orpc.deliverables.submit.mutationOptions(),
};

// ============================================================================
// STUDIO PAYMENTS QUERY OPTIONS (Received Amounts & Schedules)
// ============================================================================

export const studioPaymentsApi = {
	// Received amounts
	listReceivedOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.listReceived.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.listReceived.queryOptions({ input: input ?? {} }),

	getReceivedOptions: (id: string) =>
		orpc.studioPayments.getReceived.queryOptions({ input: { id } }),

	// Payment schedules
	listSchedulesOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.listSchedules.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.listSchedules.queryOptions({ input: input ?? {} }),

	getScheduleOptions: (id: string) =>
		orpc.studioPayments.getSchedule.queryOptions({ input: { id } }),

	// Stats
	statsOptions: (
		input?: Parameters<
			typeof orpc.studioPayments.stats.queryOptions
		>[0]["input"],
	) => orpc.studioPayments.stats.queryOptions({ input: input ?? {} }),
};

export const studioPaymentsMutations = {
	// Received amounts
	createReceived: () => orpc.studioPayments.createReceived.mutationOptions(),
	updateReceived: () => orpc.studioPayments.updateReceived.mutationOptions(),
	deleteReceived: () => orpc.studioPayments.deleteReceived.mutationOptions(),

	// Payment schedules
	createSchedule: () => orpc.studioPayments.createSchedule.mutationOptions(),
	updateSchedule: () => orpc.studioPayments.updateSchedule.mutationOptions(),
	deleteSchedule: () => orpc.studioPayments.deleteSchedule.mutationOptions(),
	convertSchedule: () =>
		orpc.studioPayments.convertSchedule.mutationOptions(),
};

// ============================================================================
// EXPENSES QUERY OPTIONS
// ============================================================================

export const expensesApi = {
	listOptions: (
		input?: Parameters<typeof orpc.expenses.list.queryOptions>[0]["input"],
	) => orpc.expenses.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.expenses.get.queryOptions({ input: { id } }),

	statsOptions: (
		input?: Parameters<typeof orpc.expenses.stats.queryOptions>[0]["input"],
	) => orpc.expenses.stats.queryOptions({ input: input ?? {} }),
};

export const expensesMutations = {
	create: () => orpc.expenses.create.mutationOptions(),
	update: () => orpc.expenses.update.mutationOptions(),
	delete: () => orpc.expenses.delete.mutationOptions(),
};

// ============================================================================
// SAVED VIEWS QUERY OPTIONS
// ============================================================================

export const savedViewsApi = {
	listOptions: (
		input: Parameters<typeof orpc.savedViews.list.queryOptions>[0]["input"],
	) => orpc.savedViews.list.queryOptions({ input }),
};

export const savedViewsMutations = {
	create: () => orpc.savedViews.create.mutationOptions(),
	update: () => orpc.savedViews.update.mutationOptions(),
	delete: () => orpc.savedViews.delete.mutationOptions(),
	toggleFavorite: () => orpc.savedViews.toggleFavorite.mutationOptions(),
};

export const recentVisitsApi = {
	listOptions: (
		input?: Parameters<
			typeof orpc.recentVisits.list.queryOptions
		>[0]["input"],
	) => orpc.recentVisits.list.queryOptions({ input: input ?? {} }),
};

export const recentVisitsMutations = {
	track: () => orpc.recentVisits.track.mutationOptions(),
};

export const quickLinksApi = {
	listOptions: () => orpc.quickLinks.list.queryOptions({ input: {} }),
};

export const quickLinksMutations = {
	create: () => orpc.quickLinks.create.mutationOptions(),
	update: () => orpc.quickLinks.update.mutationOptions(),
	delete: () => orpc.quickLinks.delete.mutationOptions(),
};

export const stickiesApi = {
	listOptions: () => orpc.stickies.list.queryOptions({ input: {} }),
};

export const stickiesMutations = {
	create: () => orpc.stickies.create.mutationOptions(),
	update: () => orpc.stickies.update.mutationOptions(),
	delete: () => orpc.stickies.delete.mutationOptions(),
};
