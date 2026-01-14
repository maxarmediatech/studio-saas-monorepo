"use client";

import { cn } from "@repo/ui/lib/utils";
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
import { SearchCommandModal } from "./search";
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

export function AppShellClient(props: AppShellClientProps) {
	return (
		<SidebarProvider>
			<AppShellContent {...props} />
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
	const [isSearchOpen, setIsSearchOpen] = React.useState(false);
	const { isPanelOpen } = useSidebar();

	const hasModules = modules.length > 0;

	const navigationConfig = React.useMemo(
		() => ({ modules, utilities, areas }),
		[modules, utilities, areas],
	);

	const currentArea = React.useMemo(() => {
		if (pathname.startsWith(`/app/${studioSlug}/settings`)) {
			return "studioSettings";
		}
		return "default";
	}, [pathname, studioSlug]);

	const activeModule = React.useMemo(
		() =>
			hasModules ? findModuleByPath(pathname, navigationConfig) : null,
		[hasModules, pathname, navigationConfig],
	);

	const activeModuleId = activeModule?.id ?? modules[0]?.id ?? "";

	const openSearch = React.useCallback(() => setIsSearchOpen(true), []);
	const closeSearch = React.useCallback(() => setIsSearchOpen(false), []);

	React.useEffect(() => {
		setMobileOpen(false);
	}, [pathname]);

	React.useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (
				(event.metaKey || event.ctrlKey) &&
				event.key.toLowerCase() === "k"
			) {
				const target = event.target as HTMLElement | null;
				const isTyping =
					target?.closest("input, textarea") ||
					target?.getAttribute("contenteditable") === "true";

				if (isTyping) return;

				event.preventDefault();
				openSearch();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [openSearch]);

	const showSidebar = hasModules || currentArea !== "default";
	const hasContent = activeModule !== null || currentArea !== "default";
	const showCornerFills = showSidebar && hasContent && isPanelOpen;

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-neutral-200">
			{/* Mobile Header */}
			<SiteHeader
				studioSlug={studioSlug}
				caps={caps}
				onMobileMenuClick={() => setMobileOpen(true)}
				onSearchOpen={openSearch}
			/>

			{/* Main Layout: Sidebar + Content */}
			<div className="flex min-h-0 flex-1 md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
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
							caps={caps}
							userName={userName}
							userImage={userImage}
							onSearchOpen={openSearch}
						/>
				)}

				{/* Content Area */}
				<div className="flex min-h-0 flex-1 flex-col bg-neutral-200 md:py-2 md:pr-2">
					<div className="relative flex min-h-0 flex-1 flex-col">
						{/* Corner fills */}
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
						{/* Content Card */}
						<main className="z-10 flex min-h-0 flex-1 flex-col overflow-hidden pt-14 md:rounded-xl md:bg-white md:pt-0">
							{children}
						</main>
					</div>
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
			<SearchCommandModal isOpen={isSearchOpen} onClose={closeSearch} />
		</div>
	);
}
