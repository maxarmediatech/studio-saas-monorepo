import "server-only";

import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import { isStaticRole } from "@repo/auth/lib/permissions";
import { db } from "@repo/database";

export async function getCustomRolePermissions(
	organizationId: string,
	role: string,
): Promise<CustomRolePermissions | undefined> {
	if (isStaticRole(role)) {
		return undefined;
	}

	const customRole = await db.query.organizationRoles.findFirst({
		where: (roles, { and, eq }) =>
			and(eq(roles.organizationId, organizationId), eq(roles.role, role)),
	});

	if (!customRole) {
		return undefined;
	}

	try {
		return JSON.parse(customRole.permission) as CustomRolePermissions;
	} catch {
		return undefined;
	}
}
