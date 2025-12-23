"use client";

import { Badge } from "@repo/ui/components/badge";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { ArrowUpRightIcon, UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { OrganizationWithStats } from "../lib/types";

type OrganizationCardProps = {
	organization: OrganizationWithStats;
};

export function OrganizationCard({ organization }: OrganizationCardProps) {
	const t = useTranslations();
	const { setActiveOrganization } = useActiveOrganization();

	return (
		<button
			type="button"
			onClick={() => setActiveOrganization(organization.slug)}
			className="group relative flex flex-col rounded-xl border bg-card p-5 text-left transition-all duration-200 hover:border-foreground/20 hover:bg-accent/50 hover:shadow-lg hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{/* Arrow indicator */}
			<ArrowUpRightIcon className="absolute top-4 right-4 size-4 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />

			{/* Logo and Name */}
			<div className="flex items-start gap-3.5">
				<OrganizationLogo
					name={organization.name}
					logoUrl={organization.logo}
					className="size-11 rounded-lg ring-1 ring-border"
				/>
				<div className="min-w-0 flex-1 pt-0.5">
					<h3 className="truncate font-semibold text-[15px] leading-tight">
						{organization.name}
					</h3>
					<p className="truncate text-muted-foreground text-sm">
						@{organization.slug}
					</p>
				</div>
			</div>

			{/* Meta info */}
			<div className="mt-4 flex items-center gap-3">
				<Badge
					variant="secondary"
					className="font-normal text-xs capitalize"
				>
					{t(`organizations.roles.${organization.role}`)}
				</Badge>

				{organization.planName && (
					<span className="text-muted-foreground text-xs">
						{organization.planName}
					</span>
				)}

				<span className="ml-auto flex items-center gap-1 text-muted-foreground text-xs">
					<UsersIcon className="size-3.5" />
					{organization.memberCount}
				</span>
			</div>
		</button>
	);
}
