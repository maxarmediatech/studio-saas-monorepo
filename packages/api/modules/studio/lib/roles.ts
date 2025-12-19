/**
 * RBAC Role Definitions for Studio Domain
 *
 * This module defines the permission statements and roles for the studio domain.
 * Ported from W-Tales with improvements for the new architecture.
 *
 * IMPORTANT: These roles are used by requirePermission() to enforce access control.
 * Any changes here affect all studio domain endpoints.
 */

// ============================================================================
// PERMISSION STATEMENTS
// Defines all possible resources and their available actions
// ============================================================================

export const statements = {
	// Core domain resources
	dashboard: ["read"],
	booking: ["create", "read", "update", "delete", "list"],
	client: ["create", "read", "update", "delete", "list"],
	shoot: ["create", "read", "update", "delete", "list", "assign"],
	deliverable: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	task: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	expense: ["create", "read", "update", "delete", "list"],
	payment: ["create", "read", "update", "delete", "list"],
	crew: ["create", "read", "update", "delete", "list"],

	// Review inbox - for viewing and resolving pending reviews across all entities
	review: ["list", "claim", "review", "approve"],

	// Configuration resources
	configuration: ["create", "read", "update", "delete", "list"],

	// Organization settings
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
} as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type Resource = keyof typeof statements;
export type Action<R extends Resource> = (typeof statements)[R][number];

// Union type of all possible actions across all resources
export type AnyAction =
	| "create"
	| "read"
	| "update"
	| "delete"
	| "list"
	| "assign"
	| "submit"
	| "review"
	| "approve"
	| "claim";

// Role permission structure
type RolePermissions = {
	[R in Resource]?: readonly Action<R>[];
};

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

/**
 * Owner - Full access to everything
 */
const ownerPermissions: RolePermissions = {
	dashboard: ["read"],
	review: ["list", "claim", "review", "approve"],
	booking: ["create", "read", "update", "delete", "list"],
	client: ["create", "read", "update", "delete", "list"],
	shoot: ["create", "read", "update", "delete", "list", "assign"],
	deliverable: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	task: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	expense: ["create", "read", "update", "delete", "list"],
	payment: ["create", "read", "update", "delete", "list"],
	crew: ["create", "read", "update", "delete", "list"],
	configuration: ["create", "read", "update", "delete", "list"],
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
};

/**
 * Admin - Same as owner (full access)
 */
const adminPermissions: RolePermissions = { ...ownerPermissions };

/**
 * Manager - Can manage shoots, tasks, deliverables; no delete on bookings/clients
 */
const managerPermissions: RolePermissions = {
	dashboard: ["read"],
	review: ["list", "claim", "review", "approve"],
	booking: ["read", "update", "list"],
	client: ["read", "list"],
	shoot: ["create", "read", "update", "list", "assign"],
	deliverable: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	task: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	expense: ["read", "list"],
	payment: ["read", "list"],
	crew: ["read", "list"],
	configuration: ["read", "list"],
};

/**
 * Post-Production Manager - Focused on tasks and deliverables
 */
const postProductionManagerPermissions: RolePermissions = {
	review: ["list", "claim", "review", "approve"],
	booking: ["read", "list"],
	shoot: ["read", "list"],
	deliverable: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	task: [
		"create",
		"read",
		"update",
		"delete",
		"list",
		"assign",
		"submit",
		"review",
		"approve",
	],
	crew: ["read", "list"],
	configuration: ["read", "list"],
};

/**
 * HR - Manages crew, expenses, and payments
 */
const hrPermissions: RolePermissions = {
	dashboard: ["read"],
	booking: ["read", "list"],
	shoot: ["read", "list"],
	deliverable: ["read", "list"],
	task: ["read", "list"],
	expense: ["create", "read", "update", "delete", "list"],
	payment: ["create", "read", "update", "delete", "list"],
	crew: ["create", "read", "update", "delete", "list"],
	configuration: ["read", "list"],
};

/**
 * Member - Internal team member with limited access
 */
const memberPermissions: RolePermissions = {
	booking: ["read", "list"],
	shoot: ["read", "list"],
	task: ["read", "list", "submit"],
	deliverable: ["read", "list", "submit"],
};

/**
 * Crew - External crew member, can only see and submit assigned work
 */
const crewPermissions: RolePermissions = {
	task: ["read", "list", "submit"],
	deliverable: ["read", "list", "submit"],
	shoot: ["read", "list"],
};

// ============================================================================
// ROLE REGISTRY
// ============================================================================

export const roles = {
	owner: ownerPermissions,
	admin: adminPermissions,
	manager: managerPermissions,
	post_production_manager: postProductionManagerPermissions,
	hr: hrPermissions,
	member: memberPermissions,
	crew: crewPermissions,
} as const;

export type AppRole = keyof typeof roles;

/**
 * Check if a role has a specific permission
 */
export function roleHasPermission(
	role: string,
	resource: Resource,
	action: AnyAction,
): boolean {
	const rolePermissions = roles[role as AppRole];
	if (!rolePermissions) return false;

	const resourceActions = rolePermissions[resource];
	if (!resourceActions) return false;

	return (resourceActions as readonly string[]).includes(action);
}
