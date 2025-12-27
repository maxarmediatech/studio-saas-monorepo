"use client";

import { SidebarTrigger } from "@repo/ui/components/sidebar";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import Link from "next/link";
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
			<div className="flex h-(--header-height) items-center gap-2 px-4">
				{/* Mobile: Sidebar trigger */}
				<SidebarTrigger className="md:hidden" />

				{/* Logo - links to studio home */}
				<Link
					href={homePath}
					className="hidden shrink-0 items-center md:flex"
				>
					<Logo withLabel={false} className="size-7" />
				</Link>

				{/* Vercel-style slash separator */}
				<span className="hidden text-muted-foreground/50 text-2xl font-light select-none md:block">
					/
				</span>

				{/* Organization switcher */}
				<OrganizationSwitcher
					studioName={studioName}
					studioLogo={studioLogo}
				/>

				{/* Module tabs */}
				<ModuleTabs modules={modules} activeModuleId={activeModuleId} />

				{/* Spacer */}
				<div className="flex-1" />

				{/* Right side actions */}
				<div className="flex items-center gap-3">
					<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
