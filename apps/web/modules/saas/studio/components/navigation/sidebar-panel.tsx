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
		<div className="scrollbar-hide relative flex h-full w-[calc(var(--sidebar-panel-width)-0.5rem)] flex-col overflow-y-auto overflow-x-hidden rounded-xl bg-neutral-100">
			{/* Navigation Content - animate on module switch */}
			<div
				key={module.id}
				className="relative flex grow animate-in fade-in slide-in-from-right-2 flex-col p-3 text-neutral-500 duration-200"
			>
				{/* Module Title */}
				<div className="mb-2 flex items-center gap-3 px-3 py-2">
					<h2 className="text-lg font-semibold text-neutral-900">
						{module.label}
					</h2>
				</div>

				<div className="flex flex-col gap-8">
					{module.sections.map((section) => (
						<div key={section.id}>
							{section.label && (
								<div className="mb-2 pl-3 text-sm text-neutral-500">
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
					? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10"
			)}
		>
			<span className="flex items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-blue-600" : "text-neutral-600"
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
