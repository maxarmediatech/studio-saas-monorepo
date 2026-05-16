"use client";

import { cn } from "@repo/ui/lib/utils";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavAreaConfig, NavItemConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

function isItemActive(
	pathname: string,
	itemPath: string,
	exact = false,
): boolean {
	if (exact) {
		return pathname === itemPath;
	}

	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function AreaNavItem({
	item,
	pathname,
}: {
	item: NavItemConfig;
	pathname: string;
}) {
	const active = isItemActive(pathname, item.path, item.exact);

	return (
		<Link
			href={item.path}
			className={cn(
				"group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
				active
					? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
					: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
			)}
		>
			<IconByName
				name={item.icon}
				className={cn(
					"size-4 shrink-0",
					active ? "text-blue-600" : "text-neutral-600",
				)}
			/>
			<span className="truncate">{item.label}</span>
		</Link>
	);
}

export function GenericAreaPanel({ area }: { area: NavAreaConfig }) {
	const pathname = usePathname();

	return (
		<div className="scrollbar-hide relative flex h-full w-[var(--sidebar-panel-width)] flex-col overflow-y-auto overflow-x-hidden rounded-l-xl bg-neutral-100">
			<div className="p-3">
				{area.backHref ? (
					<Link
						href={area.backHref}
						className="group flex items-center gap-3 px-3 py-2"
					>
						<div className="flex size-6 items-center justify-center rounded-lg bg-neutral-200 text-neutral-600 transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300">
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

			<div className="flex flex-col gap-5 px-3 pb-3">
				{area.standaloneItems?.length ? (
					<nav className="flex flex-col gap-0.5">
						{area.standaloneItems.map((item) => (
							<AreaNavItem
								key={item.id}
								item={item}
								pathname={pathname}
							/>
						))}
					</nav>
				) : null}

				{area.sections.map((section) => (
					<div key={section.id}>
						{section.label ? (
							<div className="mb-2 pl-2 text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
								{section.label}
							</div>
						) : null}
						<nav className="flex flex-col gap-0.5">
							{section.items.map((item) => (
								<AreaNavItem
									key={item.id}
									item={item}
									pathname={pathname}
								/>
							))}
						</nav>
					</div>
				))}
			</div>
		</div>
	);
}
