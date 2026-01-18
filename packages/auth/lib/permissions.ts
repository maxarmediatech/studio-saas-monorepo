/**
 * Dynamic RBAC Permission System using Better Auth Access Control
 *
 * USAGE:
 * - Import `ac` and `appRoles` in auth.ts for Better Auth config
 * - Import `statement` types for type-safe permission checks
 * - Use auth.api.hasPermission() for permission validation
 */

import { createAccessControl } from "better-auth/plugins/access";
import {
	adminAc,
	defaultStatements,
	memberAc,
	ownerAc,
} from "better-auth/plugins/organization/access";

export const statement = {
	...defaultStatements,
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
	review: ["list", "claim", "review", "approve"],
	configuration: ["create", "read", "update", "delete", "list"],
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
} as const;

export type Resource = keyof typeof statement;
export type Action<R extends Resource> = (typeof statement)[R][number];

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

export const ac = createAccessControl(statement);

/** Owner - Full access to everything including org management */
export const owner = ac.newRole({
	...ownerAc.statements,
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
});

/** Admin - Full access except organization deletion */
export const admin = ac.newRole({
	...adminAc.statements,
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
});

/** Manager - Manage shoots, tasks, deliverables; limited booking/client access */
export const manager = ac.newRole({
	...memberAc.statements,
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
});

/** Post-Production Manager - Focus on tasks and deliverables workflow */
export const post_production_manager = ac.newRole({
	...memberAc.statements,
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
});

/** HR - Manage crew, expenses, and payments */
export const hr = ac.newRole({
	...memberAc.statements,
	dashboard: ["read"],
	booking: ["read", "list"],
	shoot: ["read", "list"],
	deliverable: ["read", "list"],
	task: ["read", "list"],
	expense: ["create", "read", "update", "delete", "list"],
	payment: ["create", "read", "update", "delete", "list"],
	crew: ["create", "read", "update", "delete", "list"],
	configuration: ["read", "list"],
});

/** Member - Internal team member with limited access */
export const member = ac.newRole({
	...memberAc.statements,
	booking: ["read", "list"],
	shoot: ["read", "list"],
	task: ["read", "list", "submit"],
	deliverable: ["read", "list", "submit"],
});

/** Crew - External crew, can only see and submit assigned work */
export const crew = ac.newRole({
	task: ["read", "list", "submit"],
	deliverable: ["read", "list", "submit"],
	shoot: ["read", "list"],
});

export const appRoles = {
	owner,
	admin,
	manager,
	post_production_manager,
	hr,
	member,
	crew,
};

export type AppRole = keyof typeof appRoles;

export const staticRolesList = [
	{
		key: "owner" as const,
		label: "Owner",
		description:
			"Full access to everything including organization management",
		isSystem: true,
		canDelete: false,
	},
	{
		key: "admin" as const,
		label: "Admin",
		description: "Full access except organization deletion",
		isSystem: true,
		canDelete: false,
	},
	{
		key: "manager" as const,
		label: "Manager",
		description: "Manage shoots, tasks, and deliverables",
		isSystem: false,
		canDelete: false,
	},
	{
		key: "post_production_manager" as const,
		label: "Post-Production Manager",
		description: "Focus on tasks and deliverables workflow",
		isSystem: false,
		canDelete: false,
	},
	{
		key: "hr" as const,
		label: "HR",
		description: "Manage crew, expenses, and payments",
		isSystem: false,
		canDelete: false,
	},
	{
		key: "member" as const,
		label: "Member",
		description: "Limited access, can view and submit work",
		isSystem: false,
		canDelete: false,
	},
	{
		key: "crew" as const,
		label: "Crew",
		description: "External crew, submit assigned work only",
		isSystem: false,
		canDelete: false,
	},
] as const;

export function isStaticRole(role: string): role is AppRole {
	return role in appRoles;
}

export function getPermissionMatrix(): Array<{
	resource: Resource;
	actions: readonly string[];
}> {
	return Object.entries(statement).map(([resource, actions]) => ({
		resource: resource as Resource,
		actions,
	}));
}

export function checkStaticRolePermission(
	role: string,
	resource: Resource,
	action: AnyAction,
): boolean {
	const rolePermissions = appRoles[role as AppRole];
	if (!rolePermissions) return false;

	const permissions = rolePermissions.statements as Record<string, string[]>;
	const resourceActions = permissions[resource];
	if (!resourceActions) return false;

	return resourceActions.includes(action);
}

export type CustomRolePermissions = Record<string, string[]>;

export function checkRolePermission(
	role: string,
	resource: Resource,
	action: AnyAction,
	customRolePermissions?: CustomRolePermissions,
): boolean {
	if (isStaticRole(role)) {
		return checkStaticRolePermission(role, resource, action);
	}

	if (customRolePermissions) {
		const resourceActions = customRolePermissions[resource];
		if (!resourceActions) return false;
		return resourceActions.includes(action);
	}

	return false;
}
