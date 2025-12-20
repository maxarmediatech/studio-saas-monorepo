"use client";

import { Separator } from "@repo/ui/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@repo/ui/components/sidebar";
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
				<div className="flex flex-1 flex-col">
					{/* Mobile header */}
					<div className="sticky top-0 z-40 flex h-14 items-center border-b bg-background px-4 md:hidden">
						<SidebarTrigger />
						<Separator
							orientation="vertical"
							className="mr-2 data-[orientation=vertical]:h-4"
						/>
						<div className="font-semibold text-base text-foreground">
							{activeModule.label}
						</div>
					</div>

					{/* Main content */}
					<div className="flex flex-1 flex-col p-6 lg:p-8">{children}</div>
				</div>
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
