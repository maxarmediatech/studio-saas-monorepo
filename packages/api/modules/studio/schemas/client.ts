/**
 * Client Schemas
 *
 * Zod schemas for client/contact management endpoints.
 */

import { z } from "zod";
import {
	baseListFiltersSchema,
	createItemResponseSchema,
	createListResponseSchema,
	createSortSchema,
	emailSchema,
	idSchema,
	mutationResponseSchema,
	nameSchema,
	paginationSchema,
	phoneSchema,
	searchSchema,
} from "./common";

// ============================================================================
// CLIENT SCHEMA
// ============================================================================

/**
 * Full client schema (output)
 */
export const clientSchema = z.object({
	id: idSchema,
	organizationId: idSchema,
	name: z.string(),
	email: z.string().nullable(),
	phoneNumber: z.string().nullable(),
	alternatePhone: z.string().nullable(),
	address: z.string().nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
	createdBy: idSchema.nullable(),
	updatedBy: idSchema.nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
	deletedAt: z.string().nullable(),
	deletedBy: idSchema.nullable(),
});

export type Client = z.infer<typeof clientSchema>;

/**
 * Minimal client schema for dropdowns and references
 */
export const clientMinimalSchema = z.object({
	id: idSchema,
	name: z.string(),
	email: z.string().nullable(),
	phoneNumber: z.string().nullable(),
});

export type ClientMinimal = z.infer<typeof clientMinimalSchema>;

// ============================================================================
// LIST CLIENTS
// ============================================================================

const clientSortFields = ["name", "email", "createdAt", "updatedAt"] as const;

export const listClientsInputSchema = z
	.object({})
	.merge(paginationSchema)
	.merge(searchSchema)
	.merge(baseListFiltersSchema)
	.merge(createSortSchema(clientSortFields, "createdAt"));

export type ListClientsInput = z.infer<typeof listClientsInputSchema>;

export const listClientsOutputSchema = createListResponseSchema(clientSchema);

export type ListClientsOutput = z.infer<typeof listClientsOutputSchema>;

// ============================================================================
// GET CLIENT
// ============================================================================

export const getClientInputSchema = z.object({
	id: idSchema,
});

export type GetClientInput = z.infer<typeof getClientInputSchema>;

/**
 * Client detail includes booking history summary
 */
export const clientDetailSchema = clientSchema.extend({
	bookingsCount: z.number(),
	activeBookingsCount: z.number(),
});

export type ClientDetail = z.infer<typeof clientDetailSchema>;

export const getClientOutputSchema =
	createItemResponseSchema(clientDetailSchema);

export type GetClientOutput = z.infer<typeof getClientOutputSchema>;

// ============================================================================
// CREATE CLIENT
// ============================================================================

export const createClientInputSchema = z.object({
	name: nameSchema,
	email: emailSchema.optional(),
	phoneNumber: phoneSchema,
	alternatePhone: phoneSchema,
	address: z.string().max(1000).optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateClientInput = z.infer<typeof createClientInputSchema>;

export const createClientOutputSchema = mutationResponseSchema;

export type CreateClientOutput = z.infer<typeof createClientOutputSchema>;

// ============================================================================
// UPDATE CLIENT
// ============================================================================

export const updateClientInputSchema = z.object({
	id: idSchema,
	name: nameSchema.optional(),
	email: emailSchema.optional().nullable(),
	phoneNumber: phoneSchema.nullable(),
	alternatePhone: phoneSchema.nullable(),
	address: z.string().max(1000).optional().nullable(),
	metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type UpdateClientInput = z.infer<typeof updateClientInputSchema>;

export const updateClientOutputSchema = mutationResponseSchema;

export type UpdateClientOutput = z.infer<typeof updateClientOutputSchema>;

// ============================================================================
// DELETE CLIENT
// ============================================================================

export const deleteClientInputSchema = z.object({
	id: idSchema,
});

export type DeleteClientInput = z.infer<typeof deleteClientInputSchema>;

export const deleteClientOutputSchema = mutationResponseSchema;

export type DeleteClientOutput = z.infer<typeof deleteClientOutputSchema>;

// ============================================================================
// CLIENT STATS
// ============================================================================

export const getClientStatsInputSchema = z.object({});

export type GetClientStatsInput = z.infer<typeof getClientStatsInputSchema>;

export const clientStatsSchema = z.object({
	totalClients: z.number(),
	activeClients: z.number(),
	newClientsThisMonth: z.number(),
	clientsWithActiveBookings: z.number(),
});

export type ClientStats = z.infer<typeof clientStatsSchema>;

export const getClientStatsOutputSchema =
	createItemResponseSchema(clientStatsSchema);

export type GetClientStatsOutput = z.infer<typeof getClientStatsOutputSchema>;
