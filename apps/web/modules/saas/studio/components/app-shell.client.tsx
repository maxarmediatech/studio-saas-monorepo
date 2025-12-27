"use client";

import { SidebarInset, SidebarProvider } from "@repo/ui/components/sidebar";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { HeaderCapabilities } from "../lib/capability.server";
import type { NavItemConfig, NavModuleConfig } from "../lib/navigation/types";
import { findModuleByPath } from "../lib/navigation/utils";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";

interface AppShellClientProps {
	studioSlug: string;
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
	caps: HeaderCapabilities;
	sidebarHeader?: React.ReactNode;
	footerSlot?: React.ReactNode;
	children: React.ReactNode;
}

/**
 * Client component that renders the shell layout.
 * Receives pre-filtered navigation from server component.
 * Matches the winter-arc/studio-saas pattern exactly.
 */
export function AppShellClient({
	studioSlug,
	modules,
	utilities,
	caps,
	sidebarHeader,
	footerSlot,
	children,
}: AppShellClientProps) {
	const pathname = usePathname();

	const hasModules = modules.length > 0;

	// Build navigation config for path matching
	const navigationConfig = React.useMemo(
		() => ({ modules, utilities }),
		[modules, utilities],
	);

	// Find active module based on current pathname
	const activeModule = React.useMemo(
		() =>
			hasModules ? findModuleByPath(pathname, navigationConfig) : null,
		[hasModules, pathname, navigationConfig],
	);

	const activeModuleId = activeModule?.id ?? modules[0]?.id ?? "";

	return (
		<div className="[--header-height:3.5rem]">
			<SidebarProvider className="flex flex-col">
				<SiteHeader
					studioSlug={studioSlug}
					modules={modules}
					activeModuleId={activeModuleId}
					caps={caps}
				/>
				<div className="flex flex-1 pt-14">
					{activeModule ? (
						<>
							<AppSidebar
								activeModule={activeModule}
								utilities={utilities}
								headerSlot={sidebarHeader}
								footerSlot={footerSlot}
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
