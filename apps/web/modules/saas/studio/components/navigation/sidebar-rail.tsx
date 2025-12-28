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
		<div className="flex h-full w-16 flex-col items-center border-r bg-muted/30 py-3">
			{/* Organization Logo */}
			<Tooltip>
				<TooltipTrigger asChild>
					<Link
						href={`/app/${studioSlug}/home`}
						className="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-accent"
					>
						<OrganizationLogo
							name={studioName}
							logoUrl={studioLogo}
							className="size-8 rounded-lg"
						/>
					</Link>
				</TooltipTrigger>
				<TooltipContent side="right" sideOffset={8}>
					{studioName}
				</TooltipContent>
			</Tooltip>

			{/* Divider */}
			<div className="my-3 h-px w-8 bg-border" />

			{/* Module Icons */}
			<nav className="flex flex-1 flex-col items-center gap-1">
				{railIcons.map((item) => {
					const isActive = item.moduleId === activeModuleId;
					return (
						<Tooltip key={item.moduleId}>
							<TooltipTrigger asChild>
								<Link
									href={item.defaultPath}
									className={cn(
										"flex size-10 items-center justify-center rounded-lg transition-colors",
										isActive
											? "bg-primary/10 text-primary"
											: "text-muted-foreground hover:bg-accent hover:text-foreground"
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

			{/* Bottom: Help + User */}
			<div className="flex flex-col items-center gap-1 pt-3">
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
							className="flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-accent"
						>
							<UserAvatar
								name={userName}
								avatarUrl={userImage}
								className="size-8"
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
