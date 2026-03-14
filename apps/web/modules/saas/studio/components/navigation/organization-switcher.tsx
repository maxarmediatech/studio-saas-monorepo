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
import { usePlanData } from "@saas/payments/hooks/plan-data";
import { useOrganizationPurchases } from "@saas/payments/hooks/purchases";
import { clearCache } from "@shared/lib/cache";
import {
	BadgeCheck,
	ChevronDown,
	CreditCard,
	Loader2,
	PlusIcon,
	Settings,
	UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface OrganizationSwitcherProps {
	studioName: string;
	studioLogo?: string | null;
	studioSlug: string;
	organizationId: string;
	settingsEntryPath: string;
	variant?: "header" | "mobile" | "panel";
}

export function OrganizationSwitcher({
	studioName,
	studioLogo,
	studioSlug,
	organizationId,
	settingsEntryPath,
	variant = "header",
}: OrganizationSwitcherProps) {
	const { setActiveOrganization } = useActiveOrganization();
	const { data: allOrganizations, isLoading } = useOrganizationListQuery();
	const { planData } = usePlanData();
	const { activePlan } = useOrganizationPurchases(organizationId);
	const [switchingToSlug, setSwitchingToSlug] = useState<string | null>(null);

	const isPanel = variant === "panel";
	const isMobile = variant === "mobile";

	// Plan info
	const activePlanTitle =
		planData[activePlan?.id as keyof typeof planData]?.title;
	const planLabel = activePlanTitle ?? "Free";

	const handleOrgSwitch = async (slug: string) => {
		setSwitchingToSlug(slug);
		try {
			await clearCache();
			setActiveOrganization(slug);
		} finally {
			setSwitchingToSlug(null);
		}
	};

	// For header variant, use the original compact design
	if (!isPanel) {
		return (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						className={
							isMobile
								? "h-9 max-w-[10.5rem] min-w-0 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold text-neutral-900 hover:bg-accent"
								: "flex h-auto items-center gap-2 px-2 py-1.5 hover:bg-accent"
						}
					>
						{isMobile ? null : (
							<OrganizationLogo
								name={studioName}
								logoUrl={studioLogo}
								className="size-7 rounded-md"
							/>
						)}
						<span className="flex min-w-0 flex-col items-start leading-tight">
							<span
								className={
									isMobile
										? "truncate text-sm font-semibold"
										: "max-w-35 truncate text-sm font-medium"
								}
							>
								{studioName}
							</span>
						</span>
						<ChevronDown
							className={
								isMobile
									? "size-3.5 shrink-0 text-muted-foreground"
									: "size-3 text-muted-foreground"
							}
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
								onClick={() =>
									handleOrgSwitch(organization.slug)
								}
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

	// Panel variant: Slack-style minimal trigger + rich popover
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					className="h-auto w-full min-w-0 justify-start rounded-lg px-2 py-1.5 hover:bg-black/5 active:bg-black/10"
				>
					<span className="flex min-w-0 max-w-full items-center gap-1.5">
						<span className="min-w-0 truncate text-left text-sm font-semibold text-neutral-900">
							{studioName}
						</span>
						<ChevronDown className="size-3.5 shrink-0 text-neutral-500" />
					</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-64 rounded-xl p-0"
				side="bottom"
				align="start"
				sideOffset={8}
			>
				{/* Section 1: Current Organization Header */}
				<div className="flex items-center gap-3 border-b border-neutral-100 p-3">
					<OrganizationLogo
						name={studioName}
						logoUrl={studioLogo}
						className="size-10 rounded-lg"
					/>
					<div className="flex min-w-0 flex-col">
						<span className="truncate font-medium text-neutral-900">
							{studioName}
						</span>
						<span className="inline-flex items-center gap-1 text-xs text-neutral-500">
							<BadgeCheck className="size-3" />
							{planLabel}
						</span>
					</div>
				</div>

				{/* Section 2: Quick Actions */}
				<div className="p-1">
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link
							href={`/app/${studioSlug}/settings/invitations`}
							className="flex items-center gap-2 rounded-lg px-2 py-2"
						>
							<UserPlus className="size-4 text-neutral-500" />
							<span>Invite people</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link
							href={settingsEntryPath}
							className="flex items-center gap-2 rounded-lg px-2 py-2"
						>
							<Settings className="size-4 text-neutral-500" />
							<span>Settings</span>
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild className="cursor-pointer">
						<Link
							href={`/app/${studioSlug}/settings/billing`}
							className="flex items-center gap-2 rounded-lg px-2 py-2"
						>
							<CreditCard className="size-4 text-neutral-500" />
							<span>Manage billing</span>
						</Link>
					</DropdownMenuItem>
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
