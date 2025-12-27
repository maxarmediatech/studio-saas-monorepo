"use client";

import Link from "next/link";
import { SidebarTrigger } from "@repo/ui/components/sidebar";
import { Separator } from "@repo/ui/components/separator";
import { Logo } from "@shared/components/Logo";
import type { HeaderCapabilities } from "../lib/capability.server";
import type { NavModuleConfig } from "../lib/navigation/types";
import { ModuleTabs } from "./navigation/module-tabs";
import { NewActionSwitcher } from "./navigation/new-action-switcher";
import { OrganizationSwitcher } from "./navigation/organization-switcher";

interface SiteHeaderProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	modules: NavModuleConfig[];
	activeModuleId: string;
	caps: HeaderCapabilities;
}

export function SiteHeader({
	studioSlug,
	studioName,
	studioLogo,
	modules,
	activeModuleId,
	caps,
}: SiteHeaderProps) {
	const homePath = `/app/${studioSlug}/home`;

	return (
		<header className="fixed top-0 z-50 w-full border-b bg-background">
			<div className="flex h-14 items-center gap-3 px-3">
				{/* Mobile: Sidebar trigger */}
				<SidebarTrigger className="md:hidden" />

				{/* Logo - links to studio home */}
				<Link
					href={homePath}
					className="hidden items-center md:flex"
				>
					<Logo withLabel={false} className="size-8" />
				</Link>

				<Separator orientation="vertical" className="hidden h-6 md:block" />

				{/* Organization switcher */}
				<OrganizationSwitcher
					studioName={studioName}
					studioLogo={studioLogo}
				/>

				{/* Module tabs - desktop only */}
				<ModuleTabs modules={modules} activeModuleId={activeModuleId} />

				{/* Spacer */}
				<div className="flex-1" />

				{/* New action button */}
				<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
			</div>
		</header>
	);
}
