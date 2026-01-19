import "server-only";

import {
	type CustomRolePermissions,
	isStaticRole,
	mergeCustomRolePermissions,
	normalizeRoles,
} from "@repo/auth/lib/permissions";
import { db } from "@repo/database";

export async function getCustomRolePermissions(
	organizationId: string,
	role: string | string[],
): Promise<CustomRolePermissions | undefined> {
	const roleList = normalizeRoles(role);
	const customRoleKeys = roleList.filter((roleKey) => !isStaticRole(roleKey));

	if (customRoleKeys.length === 0) {
		return undefined;
	}

	const customRoles = await db.query.organizationRoles.findMany({
		where: (rolesTable, { and, eq, inArray }) =>
			and(
				eq(rolesTable.organizationId, organizationId),
				inArray(rolesTable.role, customRoleKeys),
			),
	});

	if (!customRoles.length) {
		return undefined;
	}

	const parsedPermissions = customRoles.map((customRole) => {
		try {
			return JSON.parse(customRole.permission) as CustomRolePermissions;
		} catch {
			return undefined;
		}
	});

	return mergeCustomRolePermissions(parsedPermissions);
}
