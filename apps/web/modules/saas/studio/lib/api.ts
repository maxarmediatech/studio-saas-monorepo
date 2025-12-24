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
} as const;

// ============================================================================
// BOOKINGS QUERY OPTIONS
// ============================================================================

export const bookingsApi = {
	// List bookings
	listOptions: (input?: Parameters<typeof orpc.bookings.list.queryOptions>[0]["input"]) =>
		orpc.bookings.list.queryOptions({ input: input ?? {} }),

	// List minimal bookings (for dropdowns)
	listMinimalOptions: (input?: Parameters<typeof orpc.bookings.listMinimal.queryOptions>[0]["input"]) =>
		orpc.bookings.listMinimal.queryOptions({ input: input ?? {} }),

	// Get single booking
	getOptions: (id: string) =>
		orpc.bookings.get.queryOptions({ input: { id } }),

	// Get booking stats
	statsOptions: () =>
		orpc.bookings.stats.queryOptions({ input: {} }),

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
	listOptions: (input?: Parameters<typeof orpc.clients.list.queryOptions>[0]["input"]) =>
		orpc.clients.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.clients.get.queryOptions({ input: { id } }),

	statsOptions: () =>
		orpc.clients.stats.queryOptions({ input: {} }),
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
	listOptions: (input?: Parameters<typeof orpc.crews.list.queryOptions>[0]["input"]) =>
		orpc.crews.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.crews.get.queryOptions({ input: { id } }),

	availabilityOptions: (input: Parameters<typeof orpc.crews.availability.queryOptions>[0]["input"]) =>
		orpc.crews.availability.queryOptions({ input }),
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
	listOptions: (input?: Parameters<typeof orpc.shoots.list.queryOptions>[0]["input"]) =>
		orpc.shoots.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.shoots.get.queryOptions({ input: { id } }),
};

export const shootsMutations = {
	create: () => orpc.shoots.create.mutationOptions(),
	update: () => orpc.shoots.update.mutationOptions(),
	delete: () => orpc.shoots.delete.mutationOptions(),
};

// ============================================================================
// CONFIGURATIONS QUERY OPTIONS
// ============================================================================

export const configurationsApi = {
	listOptions: (input?: Parameters<typeof orpc.configurations.list.queryOptions>[0]["input"]) =>
		orpc.configurations.list.queryOptions({ input: input ?? {} }),

	getOptions: (id: string) =>
		orpc.configurations.get.queryOptions({ input: { id } }),

	// Convenience helpers for specific config types
	bookingTypesOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "booking_type" } }),

	packageTypesOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "package_type" } }),

	relationTypesOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "relation_type" } }),

	crewRolesOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "crew_role" } }),

	shootStatusOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "shoot_status" } }),

	deliverableTypesOptions: () =>
		orpc.configurations.list.queryOptions({ input: { type: "deliverable_type" } }),
};

export const configurationsMutations = {
	create: () => orpc.configurations.create.mutationOptions(),
	update: () => orpc.configurations.update.mutationOptions(),
	delete: () => orpc.configurations.delete.mutationOptions(),
	seed: () => orpc.configurations.seed.mutationOptions(),
};
