"use client";

import {
	SidebarInset,
	SidebarProvider,
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

			<SidebarInset className="min-h-0 pb-20 md:pb-0">
				{/* Main content - header is rendered by each page via PageHeader component */}
				<div className="flex min-h-0 flex-1 flex-col p-6 lg:p-8">
					{children}
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
