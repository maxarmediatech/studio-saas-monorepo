"use client";

import { cn } from "@repo/ui/lib/utils";
import { useFullOrganizationQuery } from "@saas/organizations/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type { NavAreaConfig, NavItemConfig, NavSectionConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

/** Map section IDs to representative icons for the compressed sidebar */
const SECTION_ICONS: Record<string, string> = {
	studio: "Store",
	account: "User",
};

interface SettingsPanelProps {
	area: NavAreaConfig;
	organizationId: string;
	studioSlug: string;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

function isSectionActive(pathname: string, section: NavSectionConfig): boolean {
	return section.items.some((item) => {
		// For base settings path, exact match only
		if (item.path.endsWith("/settings")) {
			return pathname === item.path;
		}
		return pathname === item.path || pathname.startsWith(`${item.path}/`);
	});
}

/**
 * Renders a standalone nav item with optional parent-child tree.
 * Mirrors the NavItem pattern from sidebar-panel.tsx for visual consistency.
 */
function SettingsNavItem({
	item,
	pathname,
}: {
	item: NavItemConfig;
	pathname: string;
}) {
	const hasChildren = (item.children?.length ?? 0) > 0;
	const isSelfActive = isItemActive(pathname, item.path);

	const itemClassName = cn(
		"group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
		isSelfActive
			? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
			: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
	);

	if (hasChildren) {
		return (
			<div>
				{/* Parent link */}
				<Link href={item.path} className={itemClassName}>
					<IconByName
						name={item.icon}
						className={cn(
							"size-4 shrink-0",
							isSelfActive ? "text-blue-600" : "text-neutral-600",
						)}
					/>
					<span className="truncate">{item.label}</span>
				</Link>

				{/* Children — always visible, vertical line on left */}
				<ul className="ml-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-neutral-200 px-2.5 py-0.5">
					{item.children?.map((child) => {
						const childActive = isItemActive(pathname, child.path);
						return (
							<li key={child.id}>
								<Link
									href={child.path}
									className={cn(
										"relative flex h-8 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sm transition-colors",
										childActive
											? "overflow-visible bg-black/[0.03] font-medium text-blue-600 before:absolute before:-left-2.5 before:top-0 before:z-10 before:h-full before:w-px before:bg-blue-600 before:content-['']"
											: "text-neutral-600 hover:bg-black/5 hover:text-neutral-900",
									)}
								>
									<span className="truncate">{child.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	return (
		<Link href={item.path} className={itemClassName}>
			<IconByName
				name={item.icon}
				className={cn(
					"size-4 shrink-0",
					isSelfActive ? "text-blue-600" : "text-neutral-600",
				)}
			/>
			<span className="truncate">{item.label}</span>
		</Link>
	);
}

export function SettingsPanel({ area, organizationId, studioSlug }: SettingsPanelProps) {
	const pathname = usePathname();
	const { data: organization } = useFullOrganizationQuery(organizationId);
	const teams = organization?.teams ?? [];

	// Hydrate the "teams" standalone item with dynamic children from org query
	const hydratedStandaloneItems = useMemo(() => {
		return area.standaloneItems?.map((item) => {
			if (item.id !== "teams") return item;
			if (teams.length === 0) return item; // No children — render as flat link
			const teamChildren: NavItemConfig[] = teams.map((team) => ({
				id: `team-${team.id}`,
				label: team.name,
				path: `/app/${studioSlug}/settings/teams/${team.id}`,
			}));
			return { ...item, children: teamChildren };
		}) ?? [];
	}, [area.standaloneItems, teams, studioSlug]);

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
								"transition-[transform,background-color,color] duration-150 group-hover:-translate-x-0.5 group-hover:bg-neutral-300",
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

			{/* Navigation links */}
			<nav className="flex flex-col gap-0.5 p-3 pt-0">
				{area.sections.map((section) => {
					const firstItem = section.items[0];
					if (!firstItem) return null;
					const isActive = isSectionActive(pathname, section);
					const iconName = SECTION_ICONS[section.id] ?? firstItem.icon;

					return (
						<Link
							key={section.id}
							href={firstItem.path}
							className={cn(
								"group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
								isActive
									? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
									: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
							)}
						>
							<IconByName
								name={iconName}
								className={cn(
									"size-4 shrink-0",
									isActive ? "text-blue-600" : "text-neutral-600",
								)}
							/>
							<span className="truncate">{section.label}</span>
						</Link>
					);
				})}
				{hydratedStandaloneItems.map((item) => (
					<SettingsNavItem key={item.id} item={item} pathname={pathname} />
				))}
			</nav>
		</div>
	);
}
