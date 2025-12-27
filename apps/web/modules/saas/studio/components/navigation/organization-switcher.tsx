"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useOrganizationListQuery } from "@saas/organizations/lib/api";
import { clearCache } from "@shared/lib/cache";
import { ChevronDown, Loader2, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface OrganizationSwitcherProps {
	studioName: string;
	studioLogo?: string | null;
}

export function OrganizationSwitcher({
	studioName,
	studioLogo,
}: OrganizationSwitcherProps) {
	const { setActiveOrganization } = useActiveOrganization();
	const { data: allOrganizations, isLoading } = useOrganizationListQuery();
	const [switchingToSlug, setSwitchingToSlug] = useState<string | null>(null);

	const handleOrgSwitch = async (slug: string) => {
		setSwitchingToSlug(slug);
		try {
			await clearCache();
			setActiveOrganization(slug);
		} finally {
			setSwitchingToSlug(null);
		}
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="flex h-auto items-center gap-2 px-2 py-1.5 hover:bg-accent"
				>
					<OrganizationLogo
						name={studioName}
						logoUrl={studioLogo}
						className="size-7 rounded-md"
					/>
					<span className="max-w-[140px] truncate text-sm font-semibold">
						{studioName}
					</span>
					<ChevronDown className="size-3 text-muted-foreground" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="min-w-60 rounded-lg"
				side="bottom"
				align="start"
			>
				<DropdownMenuLabel className="text-xs text-foreground/60">
					Switch organization
				</DropdownMenuLabel>
				{isLoading ? (
					<DropdownMenuItem disabled>
						<Loader2 className="mr-2 size-4 animate-spin" />
						Loading...
					</DropdownMenuItem>
				) : !allOrganizations?.length ? (
					<DropdownMenuItem disabled>No organizations found</DropdownMenuItem>
				) : (
					allOrganizations.map((organization) => (
						<DropdownMenuItem
							key={organization.slug}
							className="flex cursor-pointer items-center gap-2"
							disabled={switchingToSlug === organization.slug}
							onClick={() => handleOrgSwitch(organization.slug)}
						>
							{switchingToSlug === organization.slug ? (
								<Loader2 className="size-6 animate-spin" />
							) : (
								<OrganizationLogo
									className="size-6"
									name={organization.name}
									logoUrl={organization.logo}
								/>
							)}
							<span className="max-w-[180px] truncate">{organization.name}</span>
						</DropdownMenuItem>
					))
				)}
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link href="/new-organization">
							<PlusIcon className="mr-2 size-4" />
							Create new organization
						</Link>
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
