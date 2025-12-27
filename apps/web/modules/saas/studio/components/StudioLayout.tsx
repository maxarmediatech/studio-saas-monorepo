"use client";

import {
	SidebarInset,
	SidebarProvider,
} from "@repo/ui/components/sidebar";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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

	// The module currently displayed in the sidebar panel
	// This can differ from urlModuleId when user is "browsing" another module
	const [displayedModuleId, setDisplayedModuleId] =
		useState<ModuleId>(urlModuleId);

	// Mobile drawer state
	const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

	// Sync displayed module with URL when pathname changes
	// This handles browser back/forward and direct navigation
	useEffect(() => {
		setDisplayedModuleId(urlModuleId);
	}, [urlModuleId]);

	// Handler for module icon clicks - allows browsing without navigation
	const handleModuleChange = useCallback((moduleId: ModuleId) => {
		setDisplayedModuleId(moduleId);
	}, []);

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
