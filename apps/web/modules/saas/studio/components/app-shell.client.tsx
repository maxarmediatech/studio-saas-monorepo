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
 * Receives pre-filtered navigation from server component.
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
		<div className="min-h-screen bg-background">
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

			{/* Header */}
			<SiteHeader
				studioSlug={studioSlug}
				caps={caps}
				onMobileMenuClick={() => setMobileOpen(true)}
			/>

			{/* Main Content */}
			<main className="pt-14 md:pl-[304px]">
				<div className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
					{children}
				</div>
			</main>

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
