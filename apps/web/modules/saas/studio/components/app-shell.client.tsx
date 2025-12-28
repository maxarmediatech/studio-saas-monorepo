"use client";

import { usePathname } from "next/navigation";
import * as React from "react";
import type { HeaderCapabilities } from "../lib/capability.server";
import type {
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../lib/navigation/types";
import { findModuleByPath } from "../lib/navigation/utils";
import { DubSidebar } from "./navigation/dub-sidebar";
import { MobileSidebar } from "./navigation/mobile-sidebar";
import { SiteHeader } from "./site-header";

interface AppShellClientProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	modules: NavModuleConfig[];
	utilities: NavItemConfig[];
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
export function AppShellClient({
	studioSlug,
	studioName,
	studioLogo,
	modules,
	utilities,
	railIcons,
	caps,
	userName,
	userImage,
	children,
}: AppShellClientProps) {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = React.useState(false);

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

	// Close mobile sidebar on navigation
	React.useEffect(() => {
		setMobileOpen(false);
	}, [pathname]);

	return (
		<div className="min-h-screen bg-neutral-200 md:grid md:grid-cols-[min-content_minmax(0,1fr)]">
			{/* Desktop Sidebar */}
			{activeModule && (
				<DubSidebar
					studioSlug={studioSlug}
					studioName={studioName}
					studioLogo={studioLogo}
					railIcons={railIcons}
					activeModule={activeModule}
					activeModuleId={activeModuleId}
					utilities={utilities}
					userName={userName}
					userImage={userImage}
				/>
			)}

			{/* Main Content Area */}
			<div className="flex min-h-screen flex-col bg-neutral-200 md:py-2 md:pr-2">
				{/* Header - inside content card on desktop */}
				<SiteHeader
					studioSlug={studioSlug}
					caps={caps}
					onMobileMenuClick={() => setMobileOpen(true)}
				/>

				{/* Content Card */}
				<main className="flex-1 pt-14 md:rounded-xl md:bg-white md:pt-0">
					<div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
						{children}
					</div>
				</main>
			</div>

			{/* Mobile Sidebar */}
			{activeModule && (
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
					pathname={pathname}
				/>
			)}
		</div>
	);
}
