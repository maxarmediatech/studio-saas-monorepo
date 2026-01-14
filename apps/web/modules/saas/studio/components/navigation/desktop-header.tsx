"use client";

import { UserMenu } from "@saas/shared/components/UserMenu";
import { BellIcon, HelpCircleIcon } from "lucide-react";
import { HeaderSearchInput } from "../search";
import { OrganizationSwitcher } from "./organization-switcher";

interface DesktopHeaderProps {
	studioName: string;
	studioLogo?: string | null;
}

export function DesktopHeader({ studioName, studioLogo }: DesktopHeaderProps) {
	return (
		<header className="hidden h-11 shrink-0 items-center justify-between px-4 md:flex">
			<div className="flex min-w-[180px] items-center">
				<OrganizationSwitcher
					studioName={studioName}
					studioLogo={studioLogo}
				/>
			</div>

			<div className="flex flex-1 items-center justify-center px-4">
				<HeaderSearchInput className="w-full max-w-md" />
			</div>

			<div className="flex min-w-[180px] items-center justify-end gap-1">
				<button
					type="button"
					className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-300/50 hover:text-neutral-700"
				>
					<HelpCircleIcon className="size-[18px]" />
				</button>
				<button
					type="button"
					className="flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-300/50 hover:text-neutral-700"
				>
					<BellIcon className="size-[18px]" />
				</button>
				<UserMenu />
			</div>
		</header>
	);
}
