import "server-only";

import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import { getSession } from "@saas/auth/lib/server";
import { getActiveOrganization } from "@saas/auth/lib/server";
import { getCustomRolePermissions } from "@saas/studio/lib/get-custom-role-permissions.server";
import {
	canAccessSettingsRoute,
	type SettingsRouteKey,
	getVisibleSettingsStandalonePages,
	getVisibleSettingsTabGroups,
} from "./access";

type SettingsAccessContext = {
	organization: NonNullable<Awaited<ReturnType<typeof getActiveOrganization>>>;
	session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
	userRole: string | string[];
	customRolePermissions?: CustomRolePermissions;
};

async function resolveSettingsAccessContext(
	organizationSlug: string,
): Promise<SettingsAccessContext | null> {
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

export async function requireSettingsRouteAccess(
	organizationSlug: string,
	routeKey: SettingsRouteKey,
): Promise<SettingsAccessContext | null> {
	const context = await resolveSettingsAccessContext(organizationSlug);

	if (!context) {
		return null;
	}

	if (
		!canAccessSettingsRoute(
			routeKey,
			context.userRole,
			context.customRolePermissions,
		)
	) {
		return null;
	}

	return context;
}

export async function getVisibleSettingsNavigation(
	organizationSlug: string,
) {
	const basePath = `/app/${organizationSlug}/settings`;
	const context = await resolveSettingsAccessContext(organizationSlug);
	const userRole = context?.userRole ?? "member";
	const customRolePermissions = context?.customRolePermissions;

	return {
		groups: getVisibleSettingsTabGroups(
			basePath,
			userRole,
			customRolePermissions,
		),
		standalonePages: getVisibleSettingsStandalonePages(
			basePath,
			userRole,
			customRolePermissions,
		),
	};
}
