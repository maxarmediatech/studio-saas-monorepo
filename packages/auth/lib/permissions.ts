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
	booking: ["create", "read", "update", "delete", "list", "reference"],
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
	expense: ["create", "read", "update", "delete", "list", "reference"],
	payment: ["create", "read", "update", "delete", "list", "reference"],
	crew: ["create", "read", "update", "delete", "list"],
	team: ["create", "read", "update", "delete", "list"],
	review: ["list", "claim", "review", "approve"],
	configuration: ["create", "read", "update", "delete", "list"],
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
	channel: ["create", "read", "update", "delete", "list"],
	discussion: ["create", "read", "update", "delete", "list"],
	conversation: ["create", "read", "update", "delete", "list"],
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
	| "claim"
	| "reference";

const ORGANIZATION_ADMIN_ROLES = ["owner", "admin"] as const;
const SYSTEM_ROLE_KEYS = ["owner", "admin", "member"] as const;
const PROFILE_ONLY_ROLE_KEYS = ["crew"] as const;

export function normalizeRoles(
	value: string | string[] | null | undefined,
): string[] {
	if (!value) {
		return [];
	}

	const rolePattern = /^[a-z][a-z0-9_]*$/;
	const raw = Array.isArray(value) ? value : [value];
	const roles: string[] = [];
	const seen = new Set<string>();

	const tryParseJsonArray = (input: string): string[] | null => {
		let candidate = input.trim();
		if (!candidate) {
			return null;
		}

		for (let attempt = 0; attempt < 2; attempt += 1) {
			try {
				const parsed = JSON.parse(candidate) as unknown;
				if (Array.isArray(parsed)) {
					return parsed.filter(
						(entry): entry is string => typeof entry === "string",
					);
				}
				if (typeof parsed === "string") {
					const next = parsed.trim();
					if (next.startsWith("[")) {
						candidate = next;
						continue;
					}
					return [parsed];
				}
			} catch {
				// Ignore parse errors and fall back to comma splitting.
			}
			break;
		}

		return null;
	};

	for (const entry of raw) {
		if (typeof entry !== "string") {
			continue;
		}
		const parsedRoles = tryParseJsonArray(entry);
		const parts = parsedRoles ?? entry.split(",");

		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) {
				continue;
			}

			const normalized = trimmed.toLowerCase();
			const cleaned = normalized.replace(
				/^[^a-z0-9_]+|[^a-z0-9_]+$/g,
				"",
			);
			if (!cleaned || !rolePattern.test(cleaned)) {
				continue;
			}
			if (seen.has(cleaned)) {
				continue;
			}
			seen.add(cleaned);
			roles.push(cleaned);
		}
	}

	return roles;
}

export function hasAnyRole(
	value: string | string[] | null | undefined,
	rolesToCheck: readonly string[],
): boolean {
	const roles = normalizeRoles(value);
	return roles.some((role) => rolesToCheck.includes(role));
}

export function coerceOrganizationRoles(
	value: string | string[] | null | undefined,
): string[] {
	const roles = normalizeRoles(value).filter(
		(role) =>
			!PROFILE_ONLY_ROLE_KEYS.includes(
				role as (typeof PROFILE_ONLY_ROLE_KEYS)[number],
			),
	);
	if (roles.length === 0) {
		return ["member"];
	}

	if (hasAnyRole(roles, ORGANIZATION_ADMIN_ROLES)) {
		return roles;
	}

	return roles.includes("member") ? roles : ["member", ...roles];
}

export function serializeRoles(
	value: string | string[] | null | undefined,
): string {
	return coerceOrganizationRoles(value).join(",");
}

export const ac = createAccessControl(statement);

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
	team: ["create", "read", "update", "delete", "list"],
	configuration: ["create", "read", "update", "delete", "list"],
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
	channel: ["create", "read", "update", "delete", "list"],
	discussion: ["create", "read", "update", "delete", "list"],
	conversation: ["create", "read", "update", "delete", "list"],
});

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
	team: ["create", "read", "update", "delete", "list"],
	configuration: ["create", "read", "update", "delete", "list"],
	settings: ["read", "update"],
	invites: ["read", "create", "delete"],
	channel: ["create", "read", "update", "delete", "list"],
	discussion: ["create", "read", "update", "delete", "list"],
	conversation: ["create", "read", "update", "delete", "list"],
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

export const member = ac.newRole({
	...memberAc.statements,
	// booking: ["read", "list"],
	// shoot: ["read", "list"],
	task: ["read", "list", "submit"],
	// deliverable: ["read", "list", "submit"],
	configuration: ["read", "list"],
	expense: ["reference"],
	payment: ["reference"],
	channel: ["read", "list"],
	discussion: ["create", "read", "list"],
	conversation: ["create", "read", "list"],
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
	member,
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
		key: "member" as const,
		label: "Member",
		description: "Limited access, can view and submit work",
		isSystem: true,
		canDelete: false,
	},
] as const;

export const editableRoleMeta = [
	{
		key: "manager" as const,
		label: "Manager",
		description: "Manage shoots, tasks, and deliverables",
	},
	{
		key: "post_production_manager" as const,
		label: "Post-Production Manager",
		description: "Focus on tasks and deliverables workflow",
	},
	{
		key: "hr" as const,
		label: "HR",
		description: "Manage crew, expenses, and payments",
	},
] as const;

export const defaultEditableRoles = [
	{ ...editableRoleMeta[0], permissions: manager.statements },
	{
		...editableRoleMeta[1],
		permissions: post_production_manager.statements,
	},
	{ ...editableRoleMeta[2], permissions: hr.statements },
] as const;

export function isProfileOnlyRole(role: string): boolean {
	return PROFILE_ONLY_ROLE_KEYS.includes(
		role as (typeof PROFILE_ONLY_ROLE_KEYS)[number],
	);
}

export function isStaticRole(role: string): role is AppRole {
	return SYSTEM_ROLE_KEYS.includes(role as AppRole);
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
	if (!rolePermissions) {
		return false;
	}

	const permissions = rolePermissions.statements as Readonly<
		Record<string, readonly string[]>
	>;
	const resourceActions = permissions[resource];
	if (!resourceActions) {
		return false;
	}

	return resourceActions.includes(action);
}

export type CustomRolePermissions = Record<string, string[]>;

export function mergeCustomRolePermissions(
	permissionsList: Array<CustomRolePermissions | null | undefined>,
): CustomRolePermissions | undefined {
	const merged: CustomRolePermissions = {};

	for (const permissions of permissionsList) {
		if (!permissions) {
			continue;
		}
		for (const [resource, actions] of Object.entries(permissions)) {
			if (!merged[resource]) {
				merged[resource] = [];
			}
			for (const action of actions) {
				if (!merged[resource].includes(action)) {
					merged[resource].push(action);
				}
			}
		}
	}

	return Object.keys(merged).length > 0 ? merged : undefined;
}

export function checkRolePermission(
	role: string | string[],
	resource: Resource,
	action: AnyAction,
	customRolePermissions?: CustomRolePermissions,
): boolean {
	const roles = normalizeRoles(role);

	for (const roleKey of roles) {
		if (isStaticRole(roleKey)) {
			if (checkStaticRolePermission(roleKey, resource, action)) {
				return true;
			}
			continue;
		}

		if (customRolePermissions) {
			const resourceActions = customRolePermissions[resource];
			if (resourceActions?.includes(action)) {
				return true;
			}
		}
	}

	return false;
}
