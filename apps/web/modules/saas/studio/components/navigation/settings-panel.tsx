"use client";

import { cn } from "@repo/ui/lib/utils";
import { useFullOrganizationQuery } from "@saas/organizations/lib/api";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavAreaConfig, NavSectionConfig } from "../../lib/navigation/types";
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

function isSectionActive(pathname: string, section: NavSectionConfig): boolean {
	return section.items.some((item) => {
		// For base settings path, exact match only
		if (item.path.endsWith("/settings")) {
			return pathname === item.path;
		}
		return pathname === item.path || pathname.startsWith(`${item.path}/`);
	});
}

export function SettingsPanel({ area, organizationId, studioSlug }: SettingsPanelProps) {
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
				{area.standaloneItems?.map((item) => {
					const isActive =
						pathname === item.path ||
						pathname.startsWith(`${item.path}/`);

					return (
						<Link
							key={item.id}
							href={item.path}
							className={cn(
								"group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none transition-[background-color,color,font-weight] duration-75",
								isActive
									? "bg-blue-100/50 font-medium text-blue-600 hover:bg-blue-100/80 active:bg-blue-100"
									: "text-neutral-700 hover:bg-black/5 active:bg-black/10",
							)}
						>
							<IconByName
								name={item.icon}
								className={cn(
									"size-4 shrink-0",
									isActive ? "text-blue-600" : "text-neutral-600",
								)}
							/>
							<span className="truncate">{item.label}</span>
						</Link>
					);
				})}
			</nav>

			{/* Teams list */}
			<TeamsSection organizationId={organizationId} studioSlug={studioSlug} />
		</div>
	);
}

function TeamsSection({ organizationId, studioSlug }: { organizationId: string; studioSlug: string }) {
	const { data: organization } = useFullOrganizationQuery(organizationId);
	const teams = organization?.teams ?? [];

	return (
		<div className="mt-4 px-3">
			<div className="mb-2 pl-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
				Your teams
			</div>
			<nav className="flex flex-col gap-0.5">
				{teams.map((team) => (
					<Link
						key={team.id}
						href={`/app/${studioSlug}/settings/teams`}
						className="group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none text-neutral-700 transition-[background-color] duration-75 hover:bg-black/5 active:bg-black/10"
					>
						<span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-neutral-300 text-[10px] font-medium text-neutral-700">
							{team.name.charAt(0).toUpperCase()}
						</span>
						<span className="truncate">{team.name}</span>
					</Link>
				))}
				<Link
					href={`/app/${studioSlug}/settings/teams`}
					className="group flex h-8 items-center gap-2.5 rounded-lg p-2 text-sm leading-none text-neutral-500 transition-[background-color,color] duration-75 hover:bg-black/5 hover:text-neutral-700 active:bg-black/10"
				>
					<IconByName
						name="Plus"
						className="size-4 shrink-0 text-neutral-400 group-hover:text-neutral-600"
					/>
					<span className="truncate">Create a Team</span>
				</Link>
			</nav>
		</div>
	);
}
