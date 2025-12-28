"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import type { NavItemConfig, NavModuleConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface SidebarPanelProps {
	module: NavModuleConfig;
	utilities: NavItemConfig[];
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function SidebarPanel({ module, utilities }: SidebarPanelProps) {
	const pathname = usePathname();

	return (
		<div className="flex h-full w-60 flex-col border-r bg-background">
			{/* Module Title */}
			<div className="flex h-14 shrink-0 items-center border-b px-4">
				<h2 className="font-semibold">{module.label}</h2>
			</div>

			{/* Scrollable Content */}
			<ScrollArea className="flex-1">
				<div className="py-2">
					{module.sections.map((section) => (
						<div key={section.id} className="px-2 py-1">
							{section.label && (
								<div className="px-2 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
									{section.label}
								</div>
							)}
							<nav className="flex flex-col gap-0.5">
								{section.items.map((item) => (
									<NavItem
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
							<NavItem
								key={item.id}
								item={item}
								isActive={isItemActive(pathname, item.path)}
							/>
						))}
					</nav>
				</div>
			)}
		</div>
	);
}

function NavItem({
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
				"flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
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
