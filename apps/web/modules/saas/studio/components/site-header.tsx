"use client";

import Link from "next/link";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import { Logo } from "@shared/components/Logo";
import type { HeaderCapabilities } from "../lib/capability.server";
import type { NavModuleConfig } from "../lib/navigation/types";
import { ModuleTabs } from "./navigation/module-tabs";
import { NewActionSwitcher } from "./navigation/new-action-switcher";

interface SiteHeaderProps {
	studioSlug: string;
	modules: NavModuleConfig[];
	activeModuleId: string;
	caps: HeaderCapabilities;
}

export function SiteHeader({
	studioSlug,
	modules,
	activeModuleId,
	caps,
}: SiteHeaderProps) {
	const homePath = `/app/${studioSlug}/home`;

	return (
		<header className="fixed top-0 z-50 w-full border-b bg-background">
			<div className="flex h-(--header-height) items-center gap-3 px-3">
				{/* Mobile: Sidebar trigger */}
				<SidebarTrigger className="md:hidden" />

				{/* Logo - links to studio home */}
				<Link
					href={homePath}
					className="flex items-center gap-3 text-lg font-semibold tracking-tight"
				>
					<Logo withLabel={false} className="size-8" />
				</Link>

				{/* Module tabs */}
				<ModuleTabs modules={modules} activeModuleId={activeModuleId} />

				{/* Spacer */}
				<div className="flex-1" />

				{/* New action button */}
				<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
			</div>
		</header>
	);
}
