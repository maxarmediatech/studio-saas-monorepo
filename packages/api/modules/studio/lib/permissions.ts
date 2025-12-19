/**
 * RBAC Permission Helpers for Studio Domain
 *
 * This module provides permission checking utilities for studio domain procedures.
 *
 * USAGE:
 * - Use `requirePermission()` in every mutation procedure (throws on denied)
 * - Use `hasPermission()` for conditional logic without throwing
 */

import { ORPCError } from "@orpc/server";
import {
	type AnyAction,
	type AppRole,
	type Resource,
	roleHasPermission,
	roles,
} from "./roles";

// ============================================================================
// CONTEXT TYPE
// The context shape expected from studioProtectedProcedure
// ============================================================================

export interface StudioContext {
	organizationId: string;
	membership: {
		id: string;
		role: string;
		organization: {
			id: string;
			name: string;
			slug: string | null;
		};
	};
	user: {
		id: string;
		email: string;
		name: string;
	};
	session: {
		id: string;
		userId: string;
		activeOrganizationId: string | null;
	};
}

// ============================================================================
// PERMISSION HELPERS
// ============================================================================

/**
 * Check if the current user has permission to perform an action on a resource.
 * Does NOT throw - returns boolean.
 *
 * @example
 * if (hasPermission(context, "booking", "delete")) {
 *   // Show delete button
 * }
 */
export function hasPermission(
	context: Pick<StudioContext, "membership">,
	resource: Resource,
	action: AnyAction,
): boolean {
	return roleHasPermission(context.membership.role, resource, action);
}

/**
 * Require permission to perform an action on a resource.
 * Throws FORBIDDEN if permission is denied.
 *
 * MUST be called at the start of every mutation procedure.
 *
 * @example
 * export const createBooking = studioProtectedProcedure
 *   .input(createBookingSchema)
 *   .handler(async ({ input, context }) => {
 *     requirePermission(context, "booking", "create");
 *     // ... rest of handler
 *   });
 */
export function requirePermission(
	context: Pick<StudioContext, "membership">,
	resource: Resource,
	action: AnyAction,
): void {
	if (!hasPermission(context, resource, action)) {
		throw new ORPCError("FORBIDDEN", {
			message: `Permission denied: cannot ${action} ${resource}`,
		});
	}
}

/**
 * Require one of multiple permissions (OR logic).
 * Throws FORBIDDEN if none of the permissions are granted.
 *
 * @example
 * requireAnyPermission(context, [
 *   { resource: "task", action: "review" },
 *   { resource: "deliverable", action: "review" },
 * ]);
 */
export function requireAnyPermission(
	context: Pick<StudioContext, "membership">,
	permissions: Array<{ resource: Resource; action: AnyAction }>,
): void {
	const hasAny = permissions.some(({ resource, action }) =>
		hasPermission(context, resource, action),
	);

	if (!hasAny) {
		const permStr = permissions
			.map(({ resource, action }) => `${action} ${resource}`)
			.join(" or ");
		throw new ORPCError("FORBIDDEN", {
			message: `Permission denied: requires ${permStr}`,
		});
	}
}

/**
 * Require all of multiple permissions (AND logic).
 * Throws FORBIDDEN if any permission is denied.
 *
 * @example
 * requireAllPermissions(context, [
 *   { resource: "booking", action: "read" },
 *   { resource: "shoot", action: "assign" },
 * ]);
 */
export function requireAllPermissions(
	context: Pick<StudioContext, "membership">,
	permissions: Array<{ resource: Resource; action: AnyAction }>,
): void {
	for (const { resource, action } of permissions) {
		requirePermission(context, resource, action);
	}
}

/**
 * Get all permissions for the current user's role.
 * Useful for sending to the client for UI permission checks.
 *
 * @example
 * return {
 *   data: booking,
 *   permissions: getPermissionsForRole(context.membership.role),
 * };
 */
export function getPermissionsForRole(role: string): Record<string, string[]> {
	const rolePermissions = roles[role as AppRole];

	if (!rolePermissions) {
		return {};
	}

	// Convert readonly arrays to mutable for JSON serialization
	const result: Record<string, string[]> = {};
	for (const [resource, actions] of Object.entries(rolePermissions)) {
		if (actions) {
			result[resource] = [...(actions as readonly string[])];
		}
	}

	return result;
}
