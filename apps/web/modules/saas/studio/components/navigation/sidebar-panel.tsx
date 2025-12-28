"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
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
		<div className="h-full overflow-hidden py-2 pr-2">
			{/* Inner rounded container - Dub style */}
			<div className="scrollbar-hide relative flex h-full w-60 flex-col overflow-y-auto overflow-x-hidden rounded-xl bg-neutral-50">
				{/* Module Title */}
				<div className="mb-2 flex items-center gap-3 px-3 py-3">
					<h2 className="text-lg font-semibold text-neutral-900">
						{module.label}
					</h2>
				</div>

				{/* Navigation Content */}
				<div className="relative flex grow flex-col px-3 text-neutral-500">
					<div className="flex flex-col gap-6">
						{module.sections.map((section) => (
							<div key={section.id}>
								{section.label && (
									<div className="mb-2 pl-2 text-sm text-neutral-500">
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
				</div>

				{/* Footer: Utilities */}
				{utilities.length > 0 && (
					<div className="shrink-0 border-t border-neutral-200 p-3">
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
				"group flex h-8 items-center justify-between rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
				isActive
					? "bg-amber-100/50 font-medium text-amber-600 hover:bg-amber-100/80 active:bg-amber-100"
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10"
			)}
		>
			<span className="flex items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-amber-600" : "text-neutral-600"
					)}
				/>
				<span className="truncate">{item.label}</span>
			</span>
			{isExternal && (
				<ExternalLink className="size-3.5 text-neutral-500 transition-transform duration-75 group-hover:-translate-y-px group-hover:translate-x-px" />
			)}
		</Link>
	);
}
