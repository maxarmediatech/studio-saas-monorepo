import type { ActiveOrganization, Session } from "@repo/auth";
import {
	type CustomRolePermissions,
	isStaticRole,
} from "@repo/auth/lib/permissions";
import { db } from "@repo/database";
import type { ReactNode } from "react";
import { getCapabilities, selectHeaderCaps } from "../lib/capability.server";
import { getNavigationConfig } from "../lib/navigation/config";
import { filterNavigationConfig } from "../lib/navigation/filter";
import type { RailIconConfig } from "../lib/navigation/types";
import { AppShellClient } from "./app-shell.client";

interface AppShellProps {
	children: ReactNode;
	session: Session;
	activeOrganization: ActiveOrganization;
}

async function getCustomRolePermissions(
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

export async function AppShell({
	children,
	session,
	activeOrganization,
}: AppShellProps) {
	const userMembership = activeOrganization.members.find(
		(member) => member.userId === session.user.id,
	);
	const userRole = userMembership?.role ?? "member";

	const customRolePermissions = await getCustomRolePermissions(
		activeOrganization.id,
		userRole,
	);

	const navigationConfig = getNavigationConfig(activeOrganization.slug ?? "");
	const filteredNavigation = filterNavigationConfig(
		navigationConfig,
		userRole,
		customRolePermissions,
	);

	const railIcons: RailIconConfig[] = filteredNavigation.modules.map((m) => ({
		moduleId: m.id,
		icon: m.icon,
		label: m.label,
		defaultPath: m.defaultPath,
	}));

	const capabilities = getCapabilities(userRole, customRolePermissions);
	const caps = selectHeaderCaps(capabilities);

	return (
		<AppShellClient
			studioSlug={activeOrganization.slug ?? ""}
			studioName={activeOrganization.name}
			studioLogo={activeOrganization.logo}
			organizationId={activeOrganization.id}
			modules={filteredNavigation.modules}
			utilities={filteredNavigation.utilities}
			areas={filteredNavigation.areas}
			railIcons={railIcons}
			caps={caps}
		>
			{children}
		</AppShellClient>
	);
}

export default AppShell;
