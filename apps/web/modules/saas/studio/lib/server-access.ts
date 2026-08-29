import "server-only";

import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import { getActiveOrganization, getSession } from "@saas/auth/lib/server";
import { cacheLife } from "next/cache";
import { getCustomRolePermissions } from "./get-custom-role-permissions.server";
import { matchesNavPermission } from "./navigation/access";
import { getStudioRoutePermission } from "./route-access";

type StudioRouteAccessContext = {
	organization: NonNullable<
		Awaited<ReturnType<typeof getActiveOrganization>>
	>;
	session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
	userRole: string | string[];
	customRolePermissions?: CustomRolePermissions;
};

async function resolveStudioRouteAccessContext(
	organizationSlug: string,
): Promise<StudioRouteAccessContext | null> {
	"use cache: private";
	// Private content needs a five-minute stale window to enter the App Shell.
	cacheLife({ stale: 300, revalidate: 300, expire: 600 });

	const [session, organization] = await Promise.all([
		getSession(),
		getActiveOrganization(organizationSlug),
	]);

	if (!session || !organization) {
		return null;
	}

	const userRole =
		organization.members.find((member) => member.userId === session.user.id)
			?.role ?? "member";
	const customRolePermissions = await getCustomRolePermissions(
		organization.id,
		userRole,
	);

	return {
		organization,
		session,
		userRole,
		customRolePermissions,
	};
}

export async function requireStudioRouteAccess(
	organizationSlug: string,
	routePath: string,
): Promise<StudioRouteAccessContext | null> {
	const context = await resolveStudioRouteAccessContext(organizationSlug);

	if (!context) {
		return null;
	}

	const routePermission = getStudioRoutePermission(
		organizationSlug,
		routePath,
	);

	if (
		routePermission &&
		!matchesNavPermission(
			routePermission,
			context.userRole,
			context.customRolePermissions,
		)
	) {
		return null;
	}

	return context;
}
