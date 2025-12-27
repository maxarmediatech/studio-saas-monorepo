import type { ActiveOrganization, Session } from "@repo/auth";
import { UserMenu } from "@saas/shared/components/UserMenu";
import type { ReactNode } from "react";
import { getCapabilities, selectHeaderCaps } from "../lib/capability.server";
import { getNavigationConfig } from "../lib/navigation/config";
import { filterNavigationConfig } from "../lib/navigation/filter";
import { AppShellClient } from "./app-shell.client";
import { OrganizationSwitcher } from "./navigation/organization-switcher";

interface AppShellProps {
	children: ReactNode;
	session: Session;
	activeOrganization: ActiveOrganization;
}

/**
 * Server component that filters navigation and capabilities based on user role.
 * Matches the winter-arc/studio-saas pattern.
 */
export async function AppShell({
	children,
	session,
	activeOrganization,
}: AppShellProps) {
	// Get user's role from organization membership
	const userMembership = activeOrganization.members.find(
		(member) => member.userId === session.user.id,
	);
	const userRole = userMembership?.role ?? "member";

	// Get and filter navigation based on role
	const navigationConfig = getNavigationConfig(activeOrganization.slug ?? "");
	const filteredNavigation = filterNavigationConfig(
		navigationConfig,
		userRole,
	);

	// Get capabilities for header actions
	const capabilities = getCapabilities(userRole);
	const caps = selectHeaderCaps(capabilities);

	return (
		<AppShellClient
			studioSlug={activeOrganization.slug ?? ""}
			modules={filteredNavigation.modules}
			utilities={filteredNavigation.utilities}
			caps={caps}
			sidebarHeader={
				<OrganizationSwitcher
					studioName={activeOrganization.name}
					studioLogo={activeOrganization.logo}
				/>
			}
			footerSlot={<UserMenu />}
		>
			{children}
		</AppShellClient>
	);
}

export default AppShell;
