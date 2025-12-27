"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { getNavigationConfig } from "../lib/navigation/config";
import { filterNavigationConfig } from "../lib/navigation/filter";
import { findModuleByPath } from "../lib/navigation/utils";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";

interface AppShellClientProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	userRole: string;
	children: React.ReactNode;
}

export function AppShellClient({
	studioSlug,
	studioName,
	studioLogo,
	userRole,
	children,
}: AppShellClientProps) {
	const pathname = usePathname();

	// Get navigation config and filter based on user role
	const navigation = React.useMemo(() => {
		const config = getNavigationConfig(studioSlug);
		return filterNavigationConfig(config, userRole);
	}, [studioSlug, userRole]);

	const hasModules = navigation.modules.length > 0;

	// Find active module based on current pathname
	const activeModule = React.useMemo(
		() => (hasModules ? findModuleByPath(pathname, navigation) : null),
		[hasModules, pathname, navigation],
	);

	const activeModuleId = activeModule?.id ?? navigation.modules[0]?.id ?? "";

	return (
		<div className="[--header-height:3.5rem]">
			<SidebarProvider className="flex flex-col">
				<SiteHeader
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					modules={navigation.modules}
					activeModuleId={activeModuleId}
				/>
				<div className="flex flex-1 pt-14">
					{activeModule ? (
						<>
							<AppSidebar
								activeModule={activeModule}
								utilities={navigation.utilities}
								footerSlot={<UserMenu />}
							/>
							<SidebarInset>
								<main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
									{children}
								</main>
							</SidebarInset>
						</>
					) : (
						<main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
							{children}
						</main>
					)}
				</div>
			</SidebarProvider>
		</div>
	);
}
