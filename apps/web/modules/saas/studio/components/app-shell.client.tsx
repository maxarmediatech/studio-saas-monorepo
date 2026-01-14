"use client";

import { GlobalSearchProvider } from "@repo/ui/components/global-search";
import { cn } from "@repo/ui/lib/utils";
import { GlobalSearchWrapper } from "@saas/shared/components/global-search";
import { usePathname } from "next/navigation";
import * as React from "react";
import type { HeaderCapabilities } from "../lib/capability.server";
import type {
	NavAreaConfig,
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../lib/navigation/types";
import { findModuleByPath } from "../lib/navigation/utils";
import { DubSidebar } from "./navigation/dub-sidebar";
import { MobileSidebar } from "./navigation/mobile-sidebar";
import { SidebarProvider, useSidebar } from "./navigation/sidebar-context";
import { SiteHeader } from "./site-header";

interface AppShellClientProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
	areas: Record<string, NavAreaConfig>;
	railIcons: RailIconConfig[];
	caps: HeaderCapabilities;
	userName: string;
	userImage?: string | null;
	children: React.ReactNode;
}

/**
 * Client component that renders the shell layout.
 * Dub-style: gray background with white rounded content card.
 */
export function AppShellClient(props: AppShellClientProps) {
	return (
		<SidebarProvider>
			<GlobalSearchProvider>
				<AppShellContent {...props} />
				<GlobalSearchWrapper />
			</GlobalSearchProvider>
		</SidebarProvider>
	);
}

function AppShellContent({
	studioSlug,
	studioName,
	studioLogo,
	modules,
	utilities,
	areas,
	railIcons,
	caps,
	userName,
	userImage,
	children,
}: AppShellClientProps) {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = React.useState(false);
	const { isPanelOpen } = useSidebar();

	const hasModules = modules.length > 0;

	// Build navigation config for path matching
	const navigationConfig = React.useMemo(
		() => ({ modules, utilities, areas }),
		[modules, utilities, areas],
	);

	// Determine current area based on pathname (Dub-style)
	// Settings routes show settings area, everything else shows default (modules)
	const currentArea = React.useMemo(() => {
		if (pathname.startsWith(`/app/${studioSlug}/settings`)) {
			return "studioSettings";
		}
		return "default";
	}, [pathname, studioSlug]);

	// Find active module based on current pathname (for default area)
	const activeModule = React.useMemo(
		() =>
			hasModules ? findModuleByPath(pathname, navigationConfig) : null,
		[hasModules, pathname, navigationConfig],
	);

	const activeModuleId = activeModule?.id ?? modules[0]?.id ?? "";

	// Close mobile sidebar on navigation
	React.useEffect(() => {
		setMobileOpen(false);
	}, [pathname]);

	// Show sidebar when we have modules or are in a special area (like settings)
	const showSidebar = hasModules || currentArea !== "default";

	// Has content in sidebar panel (module or special area)
	const hasContent = activeModule !== null || currentArea !== "default";
	// Show corner fills only when panel is actually visible
	const showCornerFills = showSidebar && hasContent && isPanelOpen;

	return (
		<div className="h-screen overflow-hidden bg-neutral-200 md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
			{/* Desktop Sidebar */}
			{showSidebar && (
				<DubSidebar
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					railIcons={railIcons}
					activeModule={activeModule}
					activeModuleId={activeModuleId}
					utilities={utilities}
					currentArea={currentArea}
					areas={areas}
					userName={userName}
					userImage={userImage}
				/>
			)}

			{/* Main Content Area */}
			<div className="flex h-screen flex-col bg-neutral-200 md:py-2 md:pr-2">
				{/* Header - mobile only */}
				<SiteHeader
					studioSlug={studioSlug}
					caps={caps}
					onMobileMenuClick={() => setMobileOpen(true)}
				/>

				{/* Content Card wrapper - relative for corner positioning */}
				<div className="relative flex min-h-0 flex-1 flex-col">
					{/* Corner fills to blend with sidebar - only show when panel is expanded */}
					<div
						className={cn(
							"absolute -left-2 top-0 z-0 hidden h-3 w-5 bg-neutral-100 transition-opacity duration-300 md:block",
							showCornerFills ? "opacity-100" : "opacity-0",
						)}
					/>
					<div
						className={cn(
							"absolute -left-2 bottom-0 z-0 hidden h-3 w-5 bg-neutral-100 transition-opacity duration-300 md:block",
							showCornerFills ? "opacity-100" : "opacity-0",
						)}
					/>
					{/* Content Card - fixed height, pages handle their own scrolling */}
					<main className="z-10 flex min-h-0 flex-1 flex-col overflow-hidden pt-14 md:rounded-xl md:bg-white md:pt-0">
						{children}
					</main>
				</div>
			</div>

			{/* Mobile Sidebar */}
			{showSidebar && (
				<MobileSidebar
					open={mobileOpen}
					onOpenChange={setMobileOpen}
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					railIcons={railIcons}
					activeModule={activeModule}
					activeModuleId={activeModuleId}
					utilities={utilities}
					currentArea={currentArea}
					areas={areas}
					pathname={pathname}
				/>
			)}
		</div>
	);
}
