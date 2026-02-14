"use client";

import { cn } from "@repo/ui/lib/utils";
import { useFullOrganizationQuery } from "@saas/organizations/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import type {
	IconName,
	NavAreaConfig,
	NavItemConfig,
	NavSectionConfig,
} from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface SettingsPanelProps {
	area: NavAreaConfig;
	organizationId: string;
	studioSlug: string;
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * Check if any item in a section is active (for compressed section highlighting).
 * The basePath guard prevents the settings root from greedy-matching all sub-paths.
 */
function isSectionActive(pathname: string, section: NavSectionConfig, basePath: string): boolean {
	return section.items.some((item) => {
		if (pathname === item.path) return true;
		if (item.path === basePath) return false;
		return pathname.startsWith(`${item.path}/`);
	});
}

/**
 * Icons for compressed sections — maps section ID to its display icon.
 * Only needed for sections that render as single compressed links.
 */
const SECTION_ICONS: Record<string, IconName> = {
	studio: "Settings2",
	account: "User",
	billing: "CreditCard",
	integrations: "Link2",
	notifications: "Bell",
};

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

	// Hydrate the "teams" section item with dynamic children from org query
	const hydratedSections = useMemo(() => {
		return area.sections.map((section) => ({
			...section,
			items: section.items.map((item) => {
				if (item.id !== "teams") return item;
				if (teams.length === 0) return item;
				const teamChildren: NavItemConfig[] = teams.map((team) => ({
					id: `team-${team.id}`,
					label: team.name,
					path: `/app/${studioSlug}/settings/teams/${team.id}`,
				}));
				return { ...item, children: teamChildren };
			}),
		}));
	}, [area.sections, teams, studioSlug]);

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

			{/* Sections: compressed (single link) or expanded (header + items) */}
			<div className="flex flex-col p-3 pt-0">
				{hydratedSections.map((section) => {
					if (section.expanded) {
						// Expanded section: header label + individual items
						return (
							<div key={section.id} className="mt-5">
								<div className="mb-2 pl-3 text-xs font-medium uppercase tracking-wider text-neutral-500">
									{section.label}
								</div>
								<nav className="flex flex-col gap-0.5">
									{section.items.map((item) => (
										<SettingsNavItem key={item.id} item={item} pathname={pathname} />
									))}
								</nav>
							</div>
						);
					}

					// Compressed section: single link using first item's path
					const basePath = `/app/${studioSlug}/settings`;
					const active = isSectionActive(pathname, section, basePath);
					const icon = SECTION_ICONS[section.id];
					const defaultPath = section.items[0]?.path;
					if (!defaultPath) return null;

					return (
						<Link
							key={section.id}
							href={defaultPath}
							className={cn(
								"group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
								active
									? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
									: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
							)}
						>
							{icon && (
								<IconByName
									name={icon}
									className={cn(
										"size-4 shrink-0",
										active ? "text-blue-600" : "text-neutral-600",
									)}
								/>
							)}
							<span className="truncate">{section.label}</span>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
