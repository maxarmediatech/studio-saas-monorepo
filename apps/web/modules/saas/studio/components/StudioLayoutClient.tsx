"use client";

import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { SheetProvider } from "@saas/shared/components/sheet-provider";
import { AppShellClient } from "./app-shell.client";
import { GlobalSheets } from "./global-sheets";

interface StudioLayoutClientProps {
	children: React.ReactNode;
}

export function StudioLayoutClient({ children }: StudioLayoutClientProps) {
	const { activeOrganization, activeOrganizationUserRole } =
		useActiveOrganization();

	if (!activeOrganization) {
		return null;
	}

	// Default to "member" if no role is set (shouldn't happen in practice)
	const userRole = activeOrganizationUserRole ?? "member";

	return (
		<SheetProvider>
			<AppShellClient
				studioSlug={activeOrganization.slug ?? ""}
				studioName={activeOrganization.name}
				studioLogo={activeOrganization.logo}
				userRole={userRole}
			>
				{children}
			</AppShellClient>
			<GlobalSheets />
		</SheetProvider>
	);
}
