"use client";

import { Button } from "@repo/ui/components/button";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import type { HeaderCapabilities } from "../lib/capability.server";
import { NewActionSwitcher } from "./navigation/new-action-switcher";
import { OrganizationSwitcher } from "./navigation/organization-switcher";
import { NotificationBell } from "./notifications";

interface SiteHeaderProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	organizationId: string;
	settingsEntryPath: string;
	caps: HeaderCapabilities;
	onSearchOpen?: () => void;
}

export function SiteHeader({
	studioSlug,
	studioName,
	studioLogo,
	organizationId,
	settingsEntryPath,
	caps,
	onSearchOpen,
}: SiteHeaderProps) {
	const homePath = `/app/${studioSlug}/home`;

	return (
		<header className="fixed top-0 right-0 left-0 z-30 bg-white md:hidden">
			<div className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4">
				<div className="flex min-w-0 items-center gap-2">
					<Link href={homePath}>
						<Logo withLabel={false} className="size-7" />
					</Link>
					<OrganizationSwitcher
						studioName={studioName}
						studioLogo={studioLogo}
						studioSlug={studioSlug}
						organizationId={organizationId}
						settingsEntryPath={settingsEntryPath}
					/>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={onSearchOpen}
						className="size-9"
						aria-label="Search"
					>
						<SearchIcon className="size-5" />
					</Button>
					<NotificationBell />
					<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
