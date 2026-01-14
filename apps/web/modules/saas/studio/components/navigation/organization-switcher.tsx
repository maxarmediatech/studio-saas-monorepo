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
import { cn } from "@repo/ui/lib/utils";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useOrganizationListQuery } from "@saas/organizations/lib/api";
import { clearCache } from "@shared/lib/cache";
import { ChevronDown, Loader2, PlusIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

interface OrganizationSwitcherProps {
	studioName: string;
	studioLogo?: string | null;
	variant?: "header" | "panel";
	subLabel?: ReactNode;
}

export function OrganizationSwitcher({
	studioName,
	studioLogo,
	variant = "header",
	subLabel,
}: OrganizationSwitcherProps) {
	const { setActiveOrganization } = useActiveOrganization();
	const { data: allOrganizations, isLoading } = useOrganizationListQuery();
	const [switchingToSlug, setSwitchingToSlug] = useState<string | null>(null);
	const isPanel = variant === "panel";
	const workspaceCount = allOrganizations?.length ?? 1;
	const fallbackLabel = `${workspaceCount} workspace${workspaceCount === 1 ? "" : "s"}`;
	const panelSubLabel = subLabel ?? (isLoading ? "Loading..." : fallbackLabel);

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
					className={cn(
						"flex h-auto items-center gap-2 px-2 py-1.5 hover:bg-accent",
						isPanel &&
							"flex-1 items-center justify-start gap-2.5 rounded-lg px-2 py-1 hover:bg-black/5 active:bg-black/10 has-[>svg]:px-2",
					)}
				>
					<OrganizationLogo
						name={studioName}
						logoUrl={studioLogo}
						className={cn(
							"size-7 rounded-md",
							isPanel && "size-8 rounded-lg",
						)}
					/>
					<span className="flex min-w-0 flex-col items-start leading-tight">
						<span
							className={cn(
								"max-w-35 truncate text-sm font-medium",
								isPanel && "text-neutral-900",
							)}
						>
							{studioName}
						</span>
						{isPanel && (
							<span className="text-xs text-neutral-500">
								{panelSubLabel}
							</span>
						)}
					</span>
					<ChevronDown
						className={cn(
							"size-3 text-muted-foreground",
							isPanel && "size-3.5 text-neutral-500",
						)}
					/>
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
					<DropdownMenuItem disabled>
						No organizations found
					</DropdownMenuItem>
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
							<span className="max-w-45 truncate">
								{organization.name}
							</span>
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
