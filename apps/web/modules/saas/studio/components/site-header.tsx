"use client";

import { Button } from "@repo/ui/components/button";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { OrganizationSwitcher } from "./navigation/organization-switcher";

interface SiteHeaderProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	organizationId: string;
	settingsEntryPath: string;
	onSearchOpen?: () => void;
}

export function SiteHeader({
	studioSlug,
	studioName,
	studioLogo,
	organizationId,
	settingsEntryPath,
	onSearchOpen,
}: SiteHeaderProps) {
	const homePath = `/app/${studioSlug}/home`;

	return (
		<header className="fixed top-0 right-0 left-0 z-30 bg-white md:hidden">
			<div className="flex h-14 items-center gap-2 border-b border-neutral-200 bg-white px-3">
				<div className="flex min-w-0 flex-1 items-center gap-1.5">
					<Link href={homePath}>
						<Logo withLabel={false} className="size-6 shrink-0" />
					</Link>
					<OrganizationSwitcher
						studioName={studioName}
						studioLogo={studioLogo}
						studioSlug={studioSlug}
						organizationId={organizationId}
						settingsEntryPath={settingsEntryPath}
						variant="mobile"
					/>
				</div>

				<div className="flex shrink-0 items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={onSearchOpen}
						className="size-8 rounded-full"
						aria-label="Search"
					>
						<SearchIcon className="size-4" />
					</Button>
					<UserMenu
						triggerClassName="flex size-8 items-center justify-center rounded-full hover:bg-black/5 active:bg-black/10"
						avatarClassName="size-8"
						includeNotifications
						showNotificationBadge
					/>
				</div>
			</div>
		</header>
	);
}
