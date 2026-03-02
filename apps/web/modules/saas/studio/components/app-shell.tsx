import type { ActiveOrganization } from "@repo/auth";
import type { CustomRolePermissions } from "@repo/auth/lib/permissions";
import type { ReactNode } from "react";
import type { HeaderCapabilities } from "../lib/capability.server";
import { getNavigationConfig } from "../lib/navigation/config";
import { filterNavigationConfig } from "../lib/navigation/filter";
import type { RailIconConfig } from "../lib/navigation/types";
import { AppShellClient } from "./app-shell.client";

interface AppShellProps {
	children: ReactNode;
	activeOrganization: ActiveOrganization;
	studioAccess: {
		userRole: string | string[];
		customRolePermissions?: CustomRolePermissions;
		caps: HeaderCapabilities;
	};
}

function getAreaEntryPath(
	activeOrganization: ActiveOrganization,
	areas: Record<string, { sections: Array<{ items: Array<{ path: string }> }>; standaloneItems?: Array<{ path: string }> }>,
): string {
	const settingsArea = areas.studioSettings;

	const firstSectionPath = settingsArea?.sections
		.flatMap((section) => section.items)
		.find((item) => Boolean(item.path))?.path;

	const firstStandalonePath = settingsArea?.standaloneItems?.find((item) =>
		Boolean(item.path),
	)?.path;

	return (
		firstSectionPath ??
		firstStandalonePath ??
		`/app/${activeOrganization.slug ?? ""}/settings/profile`
	);
}

export async function AppShell({
	children,
	activeOrganization,
	studioAccess,
}: AppShellProps) {
	const { userRole, customRolePermissions, caps } = studioAccess;

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

	const settingsEntryPath = getAreaEntryPath(
		activeOrganization,
		filteredNavigation.areas,
	);

	return (
		<AppShellClient
			studioSlug={activeOrganization.slug ?? ""}
			studioName={activeOrganization.name}
			studioLogo={activeOrganization.logo}
			organizationId={activeOrganization.id}
			settingsEntryPath={settingsEntryPath}
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
