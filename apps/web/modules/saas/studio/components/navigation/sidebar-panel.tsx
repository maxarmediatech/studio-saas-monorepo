"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { cn } from "@repo/ui/lib/utils";
import { ChevronDown, ChevronRight, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
	NavItemConfig,
	NavModuleConfig,
} from "../../lib/navigation/types";
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

	// Split sections: primary nav vs setup/configuration
	const primarySections = module.sections.filter(
		(s) => s.id !== "studio-setup",
	);
	const setupSection = module.sections.find((s) => s.id === "studio-setup");

	return (
		<div className="scrollbar-hide relative flex h-full w-[var(--sidebar-panel-width)] flex-col overflow-y-auto overflow-x-hidden rounded-l-xl bg-neutral-100">
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

				{/* Primary Sections */}
				<div className="flex flex-col gap-8">
					{primarySections.map((section) => (
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
										isActive={isItemActive(
											pathname,
											item.path,
										)}
									/>
								))}
							</nav>
						</div>
					))}
				</div>

				{/* Flex spacer - pushes setup section to bottom */}
				<div className="min-h-6 flex-1" />

				{/* Setup Section - collapsible with motion */}
				{setupSection && setupSection.items.length > 0 && (
					<Collapsible defaultOpen={false} className="group/setup">
						<div className="rounded-lg bg-neutral-200/40 p-2">
							{/* Collapsed trigger - shows "Setup" label */}
							<CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-neutral-600 transition-colors hover:bg-neutral-200/50 group-data-[state=open]/setup:hidden">
								<Settings className="size-4 text-neutral-500" />
								<span className="font-medium">
									{setupSection.label}
								</span>
								<ChevronRight className="ml-auto size-4 text-neutral-400" />
							</CollapsibleTrigger>

							{/* Expanded trigger - minimal header for collapsing */}
							<CollapsibleTrigger className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm text-neutral-500 transition-colors hover:bg-neutral-200/50 group-data-[state=closed]/setup:hidden">
								<Settings className="size-4" />
								<ChevronDown className="ml-auto size-4" />
							</CollapsibleTrigger>

							{/* Content - nav items with grid animation */}
							<CollapsibleContent className="grid transition-all duration-200 ease-out data-[state=closed]:grid-rows-[0fr] data-[state=open]:grid-rows-[1fr]">
								<nav className="flex flex-col gap-0.5 overflow-hidden">
									{setupSection.items.map((item) => (
										<NavItem
											key={item.id}
											item={item}
											isActive={isItemActive(
												pathname,
												item.path,
											)}
										/>
									))}
								</nav>
							</CollapsibleContent>
						</div>
					</Collapsible>
				)}
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
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
			)}
		>
			<span className="flex items-center gap-2.5">
				<IconByName
					name={item.icon}
					className={cn(
						"size-4 shrink-0",
						isActive ? "text-blue-600" : "text-neutral-600",
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

/**
 * SetupNavItem - Muted variant for configuration/setup items
 * Smaller text, neutral colors, less visual prominence than primary NavItem
 */
function SetupNavItem({
	item,
	isActive,
}: {
	item: NavItemConfig;
	isActive: boolean;
}) {
	return (
		<Link
			href={item.path}
			className={cn(
				"group flex h-7 items-center rounded-md px-2 text-xs transition-colors",
				isActive
					? "bg-neutral-200/50 font-medium text-neutral-700"
					: "text-neutral-500 hover:bg-neutral-200/30 hover:text-neutral-600",
			)}
		>
			<span className="flex items-center gap-2">
				<IconByName
					name={item.icon}
					className={cn(
						"size-3.5 shrink-0",
						isActive ? "text-neutral-600" : "text-neutral-400",
					)}
				/>
				<span className="truncate">{item.label}</span>
			</span>
		</Link>
	);
}
