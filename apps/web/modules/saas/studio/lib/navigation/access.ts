import {
	type CustomRolePermissions,
	checkRolePermission,
	hasAnyRole,
} from "@repo/auth/lib/permissions";
import type { NavPermissionCheck } from "./types";

export function matchesNavPermission(
	permission: NavPermissionCheck | undefined,
	userRole: string | string[],
	customRolePermissions?: CustomRolePermissions,
): boolean {
	if (!permission) {
		return true;
	}

	const checks: boolean[] = [];

	if (permission.rolesAny && permission.rolesAny.length > 0) {
		checks.push(hasAnyRole(userRole, permission.rolesAny));
	}

	if (permission.any && permission.any.length > 0) {
		checks.push(
			permission.any.some(({ resource, action }) =>
				checkRolePermission(
					userRole,
					resource as never,
					action as never,
					customRolePermissions,
				),
			),
		);
	}

	if (permission.all && permission.all.length > 0) {
		checks.push(
			permission.all.every(({ resource, action }) =>
				checkRolePermission(
					userRole,
					resource as never,
					action as never,
					customRolePermissions,
				),
			),
		);
	}

	if (checks.length === 0) {
		return true;
	}

	return checks.some(Boolean);
}
