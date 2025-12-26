"use client";

import { Separator } from "@repo/ui/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@repo/ui/components/sidebar";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { findActiveModule, getSidebarData } from "../lib/navigation";
import type { ModuleId } from "../lib/types";
import { MobileNav } from "./MobileNav";
import { StudioSidebar } from "./StudioSidebar";

interface StudioLayoutProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	children: React.ReactNode;
}

export function StudioLayout({
	studioSlug,
	studioName,
	studioLogo,
	children,
}: StudioLayoutProps) {
	const pathname = usePathname();
	const { modules, utilities } = getSidebarData(studioSlug);

	// Determine initial active module from URL
	const initialModule = findActiveModule(modules, pathname, studioSlug);
	const [activeModuleId, setActiveModuleId] = useState<ModuleId>(initialModule);
	const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

	const activeModule =
		modules.find((module) => module.id === activeModuleId) ?? modules[0];

	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "300px",
				} as React.CSSProperties
			}
		>
			{/* Desktop sidebar */}
			<div className="hidden md:block">
				<StudioSidebar
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					activeModuleId={activeModuleId}
					onModuleChange={setActiveModuleId}
				/>
			</div>

			<SidebarInset className="pb-20 md:pb-0">
				{/* Seamless header spanning full width */}
				<header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background">
					<div className="flex flex-1 items-center justify-between gap-2 px-4">
						{/* Mobile: show sidebar trigger and module label */}
						<div className="flex items-center gap-2 md:hidden">
							<SidebarTrigger />
							<Separator
								orientation="vertical"
								className="data-[orientation=vertical]:h-4"
							/>
							<span className="font-semibold text-base text-foreground">
								{activeModule.label}
							</span>
						</div>

						{/* Desktop: empty left side (breadcrumbs could go here) */}
						<div className="hidden md:block" />

						{/* Right side: User menu */}
						<div className="hidden md:block">
							<UserMenu />
						</div>
					</div>
				</header>

				{/* Main content */}
				<div className="flex flex-1 flex-col p-6 lg:p-8">{children}</div>
			</SidebarInset>

			{/* Mobile navigation */}
			<MobileNav
				modules={modules}
				utilities={utilities}
				activeModuleId={activeModuleId}
				onModuleChange={setActiveModuleId}
				isDrawerOpen={isMobileDrawerOpen}
				onDrawerOpenChange={setIsMobileDrawerOpen}
			/>
		</SidebarProvider>
	);
}
