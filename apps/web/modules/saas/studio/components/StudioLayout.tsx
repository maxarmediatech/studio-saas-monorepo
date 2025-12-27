"use client";

import {
	SidebarInset,
	SidebarProvider,
} from "@repo/ui/components/sidebar";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useSidebarParams } from "../hooks/params";
import { findActiveModuleId, getSidebarData } from "../lib/navigation";
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
	const { browseModule, setBrowseModule } = useSidebarParams();

	// Memoize sidebar data to avoid recalculation
	const { modules, utilities } = useMemo(
		() => getSidebarData(studioSlug),
		[studioSlug],
	);

	// The module that owns the current URL (derived from pathname)
	const urlModuleId = useMemo(
		() => findActiveModuleId(modules, pathname, studioSlug),
		[modules, pathname, studioSlug],
	);

	// The module displayed in the panel:
	// - If browseModule is set (via URL param), show that
	// - Otherwise, show the module that owns the current URL
	const displayedModuleId = browseModule ?? urlModuleId;

	// Mobile drawer state (kept local since it's UI-only)
	const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

	// Handler for module icon clicks
	const handleModuleChange = useCallback(
		(moduleId: ModuleId) => {
			// If clicking the module we're already on (by URL), clear browse state
			// Otherwise, set browse state to the clicked module
			if (moduleId === urlModuleId) {
				setBrowseModule(null);
			} else {
				setBrowseModule(moduleId);
			}
		},
		[urlModuleId, setBrowseModule],
	);

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
					modules={modules}
					utilities={utilities}
					urlModuleId={urlModuleId}
					displayedModuleId={displayedModuleId}
					onModuleChange={handleModuleChange}
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
				studioSlug={studioSlug}
				modules={modules}
				utilities={utilities}
				urlModuleId={urlModuleId}
				displayedModuleId={displayedModuleId}
				onModuleChange={handleModuleChange}
				isDrawerOpen={isMobileDrawerOpen}
				onDrawerOpenChange={setIsMobileDrawerOpen}
			/>
		</SidebarProvider>
	);
}
