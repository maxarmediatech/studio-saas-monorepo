"use client";

import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import type {
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface MobileSidebarProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig;
	activeModuleId: string;
	utilities: NavItemConfig[];
	pathname: string;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function MobileSidebar({
	open,
	onOpenChange,
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModule,
	activeModuleId,
	utilities,
	pathname,
}: MobileSidebarProps) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="left" className="w-80 p-0">
				<SheetHeader className="border-b px-4 py-3">
					<SheetTitle className="flex items-center gap-3">
						<OrganizationLogo
							name={studioName}
							logoUrl={studioLogo}
							className="size-8 rounded-lg"
						/>
						<span className="font-semibold">{studioName}</span>
					</SheetTitle>
				</SheetHeader>

				{/* Module Tabs */}
				<div className="flex gap-1 overflow-x-auto border-b px-2 py-2">
					{railIcons.map((item) => {
						const isActive = item.moduleId === activeModuleId;
						return (
							<Link
								key={item.moduleId}
								href={item.defaultPath}
								className={cn(
									"flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
									isActive
										? "bg-primary/10 font-medium text-primary"
										: "text-muted-foreground hover:bg-accent hover:text-foreground"
								)}
							>
								<IconByName name={item.icon} className="size-4" />
								<span>{item.label}</span>
							</Link>
						);
					})}
				</div>

				{/* Module Content */}
				<ScrollArea className="flex-1">
					<div className="py-2">
						{activeModule.sections.map((section) => (
							<div key={section.id} className="px-2 py-1">
								{section.label && (
									<div className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
										{section.label}
									</div>
								)}
								<nav className="flex flex-col gap-0.5">
									{section.items.map((item) => (
										<MobileNavItem
											key={item.id}
											item={item}
											isActive={isItemActive(pathname, item.path)}
										/>
									))}
								</nav>
							</div>
						))}
					</div>
				</ScrollArea>

				{/* Footer: Utilities */}
				{utilities.length > 0 && (
					<div className="shrink-0 border-t px-2 py-2">
						<nav className="flex flex-col gap-0.5">
							{utilities.map((item) => (
								<MobileNavItem
									key={item.id}
									item={item}
									isActive={isItemActive(pathname, item.path)}
								/>
							))}
						</nav>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

function MobileNavItem({
	item,
	isActive,
}: {
	item: NavItemConfig;
	isActive: boolean;
}) {
	const isExternal = item.path.startsWith("http");

	return (
		<Link
			href={item.path}
			target={isExternal ? "_blank" : undefined}
			rel={isExternal ? "noopener noreferrer" : undefined}
			className={cn(
				"flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
				isActive
					? "bg-primary/10 font-medium text-primary"
					: "text-foreground hover:bg-accent"
			)}
		>
			<IconByName name={item.icon} className="size-4 shrink-0" />
			<span className="flex-1 truncate">{item.label}</span>
			{isExternal && (
				<ExternalLink className="size-3 shrink-0 text-muted-foreground" />
			)}
		</Link>
	);
}
