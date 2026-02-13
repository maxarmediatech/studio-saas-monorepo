"use client";

import { cn } from "@repo/ui/lib/utils";
import { PageWidthWrapper } from "@saas/studio/components/PageWidthWrapper";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

interface TabItem {
	label: string;
	href: string;
}

interface TabGroup {
	id: string;
	label: string;
	tabs: TabItem[];
}

function getTabGroups(basePath: string): TabGroup[] {
	return [
		{
			id: "studio",
			label: "Studio",
			tabs: [
				{ label: "General", href: `${basePath}` },
				{ label: "Integrations", href: `${basePath}/integrations` },
				{ label: "Billing", href: `${basePath}/billing` },
				{ label: "Danger Zone", href: `${basePath}/danger-zone` },
			],
		},
		{
			id: "access",
			label: "Access",
			tabs: [
				{ label: "Members", href: `${basePath}/members` },
				{ label: "Invitations", href: `${basePath}/invitations` },
				{ label: "Roles", href: `${basePath}/roles` },
				{ label: "Teams", href: `${basePath}/teams` },
			],
		},
		{
			id: "account",
			label: "Account",
			tabs: [
				{ label: "Profile", href: `${basePath}/profile` },
				{ label: "Security", href: `${basePath}/security` },
				{ label: "Notifications", href: `${basePath}/notifications` },
				{ label: "Danger Zone", href: `${basePath}/account/danger-zone` },
			],
		},
	];
}

function getActiveGroup(
	pathname: string,
	groups: TabGroup[],
): TabGroup {
	for (const group of groups) {
		for (const tab of group.tabs) {
			if (pathname === tab.href || pathname.startsWith(`${tab.href}/`)) {
				return group;
			}
		}
	}
	return groups[0];
}

export function SettingsNav() {
	const pathname = usePathname();
	const params = useParams<{ organizationSlug: string }>();
	const basePath = `/app/${params.organizationSlug}/settings`;
	const groups = getTabGroups(basePath);
	const activeGroup = getActiveGroup(pathname, groups);

	return (
		<div className="shrink-0">
			{/* Header bar */}
			<div className="border-b border-neutral-200">
				<PageWidthWrapper>
					<div className="flex h-12 items-center sm:h-16">
						<h1 className="text-lg font-semibold text-neutral-900">
							{activeGroup.label}
						</h1>
					</div>
				</PageWidthWrapper>
			</div>

			{/* Tab bar */}
			<div className="border-b border-neutral-200">
				<PageWidthWrapper>
					<div className="-mb-px flex gap-6 overflow-x-auto">
						{activeGroup.tabs.map((tab) => {
							const isActive =
								pathname === tab.href ||
								(tab.href !== basePath &&
									pathname.startsWith(`${tab.href}/`));

							return (
								<Link
									key={tab.href}
									href={tab.href}
									className={cn(
										"relative shrink-0 pb-2 pt-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
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
		</div>
	);
}
