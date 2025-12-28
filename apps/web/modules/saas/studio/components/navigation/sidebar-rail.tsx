"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { UserAvatar } from "@shared/components/UserAvatar";
import type { RailIconConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface SidebarRailProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModuleId: string;
	userName: string;
	userImage?: string | null;
	onUserClick?: () => void;
}

export function SidebarRail({
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModuleId,
	userName,
	userImage,
	onUserClick,
}: SidebarRailProps) {
	return (
		<div className="flex h-full w-16 flex-col items-center justify-between py-2">
			{/* Top: Logo + Module Icons */}
			<div className="flex flex-col items-center">
				{/* Organization Logo */}
				<div className="flex flex-col items-center p-2 pb-1 pt-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Link
								href={`/app/${studioSlug}/home`}
								className="block rounded-lg px-1 py-4 transition-opacity hover:opacity-80"
							>
								<OrganizationLogo
									name={studioName}
									logoUrl={studioLogo}
									className="size-7 rounded-full"
								/>
							</Link>
						</TooltipTrigger>
						<TooltipContent side="right" sideOffset={8}>
							{studioName}
						</TooltipContent>
					</Tooltip>
				</div>

				{/* Module Icons */}
				<nav className="flex flex-col items-center gap-3">
					{railIcons.map((item) => {
						const isActive = item.moduleId === activeModuleId;
						return (
							<Tooltip key={item.moduleId}>
								<TooltipTrigger asChild>
									<Link
										href={item.defaultPath}
										className={cn(
											"relative flex size-11 items-center justify-center rounded-lg transition-colors duration-150",
											isActive
												? "bg-white text-neutral-900"
												: "text-neutral-600 hover:bg-black/5 active:bg-black/10"
										)}
									>
										<IconByName name={item.icon} className="size-5" />
									</Link>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									{item.label}
								</TooltipContent>
							</Tooltip>
						);
					})}
				</nav>
			</div>

			{/* Bottom: Help + User */}
			<div className="flex flex-col items-center gap-3 py-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="flex size-11 items-center justify-center rounded-lg text-neutral-600 transition-colors duration-150 hover:bg-black/5 active:bg-black/10"
						>
							<HelpCircle className="size-5" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						Help & Support
					</TooltipContent>
				</Tooltip>

				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onUserClick}
							className="flex size-11 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-black/5 active:bg-black/10"
						>
							<UserAvatar
								name={userName}
								avatarUrl={userImage}
								className="size-7"
							/>
						</button>
					</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						{userName}
					</TooltipContent>
				</Tooltip>
			</div>
		</div>
	);
}
