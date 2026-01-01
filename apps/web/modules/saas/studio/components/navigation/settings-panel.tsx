"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { NavAreaConfig, NavItemConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface SettingsPanelProps {
	area: NavAreaConfig;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	// Exact match or starts with path followed by /
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function SettingsPanel({ area }: SettingsPanelProps) {
	const pathname = usePathname();

	return (
		<div className="scrollbar-hide relative flex h-full w-[var(--sidebar-panel-width)] flex-col overflow-y-auto overflow-x-hidden rounded-l-xl bg-neutral-100">
			{/* Header with back button */}
			<div className="p-3">
				{area.backHref ? (
					<Link
						href={area.backHref}
						className="group flex items-center gap-3 px-3 py-2"
					>
						<div
							className={cn(
								"flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600",
								"transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300"
							)}
						>
							<ChevronLeft className="size-3" strokeWidth={2.5} />
						</div>
						<span className="text-lg font-semibold text-neutral-900">
							{area.title}
						</span>
					</Link>
				) : (
					<div className="flex items-center gap-3 px-3 py-2">
						<span className="text-lg font-semibold text-neutral-900">
							{area.title}
						</span>
					</div>
				)}
			</div>

			{/* Sections */}
			<div className="flex flex-col gap-8 p-3 pt-0 text-neutral-500">
				{area.sections.map((section) => (
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
