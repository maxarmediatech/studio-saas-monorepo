"use client";

import { UserMenu } from "@saas/shared/components/UserMenu";
import type { HeaderCapabilities } from "../../lib/capability.server";
import { HeaderSearchInput } from "../search";
import { NewActionSwitcher } from "./new-action-switcher";
import { OrganizationSwitcher } from "./organization-switcher";

interface DesktopHeaderProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	caps: HeaderCapabilities;
}

export function DesktopHeader({
	studioSlug,
	studioName,
	studioLogo,
	caps,
}: DesktopHeaderProps) {
	return (
		<header className="hidden h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 md:flex">
			{/* Left: Organization Switcher */}
			<div className="flex min-w-[200px] items-center">
				<OrganizationSwitcher
					studioName={studioName}
					studioLogo={studioLogo}
				/>
			</div>

			{/* Center: Search Input */}
			<div className="flex flex-1 items-center justify-center px-4">
				<HeaderSearchInput className="w-full max-w-lg" />
			</div>

			{/* Right: Actions */}
			<div className="flex min-w-[200px] items-center justify-end gap-2">
				<NewActionSwitcher studioSlug={studioSlug} caps={caps} />
				<UserMenu />
			</div>
		</header>
	);
}
