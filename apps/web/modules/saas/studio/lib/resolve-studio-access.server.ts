import "server-only";

import type { ActiveOrganization, Session } from "@repo/auth";
import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import {
	getCapabilities,
	selectHeaderCaps,
	type HeaderCapabilities,
} from "./capability.server";
import { getCustomRolePermissions } from "./get-custom-role-permissions.server";

export interface StudioAccess {
	userRole: string | string[];
	customRolePermissions?: CustomRolePermissions;
	caps: HeaderCapabilities;
}

export async function resolveStudioAccess(
	activeOrganization: ActiveOrganization,
	session: Session,
): Promise<StudioAccess> {
	const userRole =
		activeOrganization.members.find(
			(member) => member.userId === session.user.id,
		)?.role ?? "member";

	const customRolePermissions = await getCustomRolePermissions(
		activeOrganization.id,
		userRole,
	);

	return {
		userRole,
		customRolePermissions,
		caps: selectHeaderCaps(
			getCapabilities(userRole, customRolePermissions),
		),
	};
}
