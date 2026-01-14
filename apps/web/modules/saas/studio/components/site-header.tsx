"use client";

import { Button } from "@repo/ui/components/button";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import { Menu, SearchIcon } from "lucide-react";
import Link from "next/link";
import type { HeaderCapabilities } from "../lib/capability.server";
import { NewActionSwitcher } from "./navigation/new-action-switcher";

interface SiteHeaderProps {
	studioSlug: string;
	caps: HeaderCapabilities;
	onMobileMenuClick?: () => void;
	onSearchOpen?: () => void;
}

export function SiteHeader({
	studioSlug,
	caps,
	onMobileMenuClick,
	onSearchOpen,
}: SiteHeaderProps) {
	const homePath = `/app/${studioSlug}/home`;

	return (
		<header className="fixed top-0 right-0 left-0 z-30 bg-white md:hidden">
			<div className="flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4">
				{/* Mobile: Menu trigger + Logo */}
				<div className="flex items-center gap-2">
					<Button
						variant="ghost"
						size="icon"
						onClick={onMobileMenuClick}
						className="size-9"
					>
						<Menu className="size-5" />
						<span className="sr-only">Toggle menu</span>
					</Button>
					<Link href={homePath}>
						<Logo withLabel={false} className="size-7" />
					</Link>
				</div>

				{/* Right side actions - mobile only */}
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
					<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
