"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { Logo } from "@shared/components/Logo";
import { UserAvatar } from "@shared/components/UserAvatar";
import { HelpCircle, Settings } from "lucide-react";
import Link from "next/link";
import type { RailIconConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";
import { SidebarTrigger } from "./sidebar-trigger";

interface SidebarRailProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModuleId: string;
	currentArea: string;
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
	currentArea,
	userName,
	userImage,
	onUserClick,
}: SidebarRailProps) {
	const isSettingsActive = currentArea === "studioSettings";

	return (
		<div className="flex h-full w-16 flex-col items-center justify-between">
			{/* Top: App Logo + Org Switcher + Module Icons */}
			<div className="flex flex-col items-center p-2">
				{/* App Logo/Wordmark */}
				<div className="pb-1 pt-2">
					<Link
						href={`/app/${studioSlug}/home`}
						className="block rounded-lg px-1 py-4 outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-black/50"
					>
						<Logo withLabel={false} className="h-5" />
					</Link>
				</div>

				{/* Org Switcher + Module Icons */}
				<div className="flex flex-col items-center gap-3">
					{/* Organization Dropdown */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex size-11 items-center justify-center rounded-lg p-1.5 outline-none transition-colors duration-150 hover:bg-black/5 active:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/50"
							>
								<OrganizationLogo
									name={studioName}
									logoUrl={studioLogo}
									className="size-7 rounded-full"
								/>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							side="right"
							align="start"
							sideOffset={8}
						>
							<div className="px-2 py-1.5">
								<p className="text-sm font-medium">
									{studioName}
								</p>
							</div>
							<DropdownMenuSeparator />
							<DropdownMenuItem asChild>
								<Link
									href={`/app/${studioSlug}/settings`}
									className="flex items-center gap-2"
								>
									<Settings className="size-4" />
									<span>Settings</span>
								</Link>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					{/* Module Icons */}
					{railIcons.map((item) => {
						const isActive =
							item.moduleId === activeModuleId &&
							!isSettingsActive;
						return (
							<Tooltip key={item.moduleId}>
								<TooltipTrigger asChild>
									<Link
										href={item.defaultPath}
										className={cn(
											"relative flex size-11 items-center justify-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-black/50",
											isActive
												? "bg-white text-neutral-900"
												: "text-neutral-600 hover:bg-black/5 active:bg-black/10",
										)}
									>
										<IconByName
											name={item.icon}
											className="size-5"
										/>
									</Link>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>
									{item.label}
								</TooltipContent>
							</Tooltip>
						);
					})}
				</div>
			</div>

			{/* Bottom: Collapse + Settings + Help + User */}
			<div className="flex flex-col items-center gap-3 py-3">
				{/* Panel Collapse/Expand */}
				<SidebarTrigger className="size-11 text-neutral-600 hover:bg-black/5 active:bg-black/10" />

				{/* Settings Icon */}
				<Tooltip>
					<TooltipTrigger asChild>
						<Link
							href={`/app/${studioSlug}/settings`}
							className={cn(
								"flex size-11 items-center justify-center rounded-lg outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-black/50",
								isSettingsActive
									? "bg-white text-neutral-900"
									: "text-neutral-600 hover:bg-black/5 active:bg-black/10",
							)}
						>
							<Settings className="size-5" />
						</Link>
					</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						Settings
					</TooltipContent>
				</Tooltip>

				{/* Help */}
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="flex size-11 items-center justify-center rounded-lg text-neutral-600 outline-none transition-colors duration-150 hover:bg-black/5 active:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/50"
						>
							<HelpCircle className="size-5" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right" sideOffset={8}>
						Help & Support
					</TooltipContent>
				</Tooltip>

				{/* User Avatar */}
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onUserClick}
							className="flex size-11 items-center justify-center rounded-lg outline-none transition-colors duration-150 hover:bg-black/5 active:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/50"
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
