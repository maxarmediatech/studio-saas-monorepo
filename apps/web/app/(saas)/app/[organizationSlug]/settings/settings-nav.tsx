"use client";

import { cn } from "@repo/ui/lib/utils";
import { PageWidthWrapper } from "@saas/studio/components/PageWidthWrapper";
import type {
	SettingsStandalonePage,
	SettingsTabGroup,
} from "@saas/settings/lib/access";
import Link from "next/link";
import { usePathname } from "next/navigation";

function getActiveStandalone(
	pathname: string,
	pages: SettingsStandalonePage[],
): SettingsStandalonePage | null {
	for (const page of pages) {
		if (
			pathname === page.href ||
			pathname.startsWith(`${page.href}/`)
		) {
			return page;
		}
	}
	return null;
}

function getActiveGroup(
	pathname: string,
	groups: SettingsTabGroup[],
): SettingsTabGroup | null {
	for (const group of groups) {
		for (const tab of group.tabs) {
			if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
				return group;
			}
		}
	}
	return groups[0] ?? null;
}

export function SettingsNav({
	groups,
	standalonePages,
}: {
	groups: SettingsTabGroup[];
	standalonePages: SettingsStandalonePage[];
}) {
	const pathname = usePathname();

	// Check standalone pages first — they take priority over tab groups
	const activeStandalone = getActiveStandalone(pathname, standalonePages);
	const activeGroup = activeStandalone ? null : getActiveGroup(pathname, groups);

	// Determine header label and whether to show tab bar
	const headerLabel =
		activeStandalone?.label ?? activeGroup?.label ?? "Settings";
	const showTabs = !activeStandalone && (activeGroup?.tabs.length ?? 0) > 1;

	return (
		<div className="shrink-0">
			{/* Header bar */}
			<div className="border-b border-neutral-200">
				<PageWidthWrapper>
					<div className="flex h-12 items-center sm:h-16">
						<h1 className="text-lg font-semibold text-neutral-900">
							{headerLabel}
						</h1>
						<div className="ml-auto" id="settings-header-actions" />
					</div>
				</PageWidthWrapper>
			</div>

			{/* Tab bar — hidden for standalone pages and single-tab groups */}
			{showTabs && (
				<div className="border-b border-neutral-200">
					<PageWidthWrapper>
						<div className="-mb-px flex gap-6 overflow-x-auto">
							{activeGroup?.tabs.map((tab) => {
								const isActive =
									pathname === tab.href ||
									pathname.startsWith(`${tab.href}/`);

								return (
									<Link
										key={tab.href}
										href={tab.href}
										className={cn(
											"relative shrink-0 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
											isActive && "text-foreground",
										)}
									>
										{tab.label}
										{isActive && (
											<div className="absolute inset-x-0 bottom-0 h-0.5 bg-neutral-900" />
										)}
									</Link>
								);
							})}
						</div>
					</PageWidthWrapper>
				</div>
			)}
		</div>
	);
}
