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
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger,
	useSidebar,
} from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import { OrganizationLogo } from "@saas/organizations/components/OrganizationLogo";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { useOrganizationListQuery } from "@saas/organizations/lib/api";
import { UserMenu } from "@saas/shared/components/UserMenu";
import { Logo } from "@shared/components/Logo";
import { clearCache } from "@shared/lib/cache";
import { ChevronDown, Loader2, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getIcon } from "../lib/icons";
import type { ModuleId, NavItem, NavModule } from "../lib/types";
import { ModulePanel } from "./ModulePanel";

interface OrganizationSwitcherProps {
	studioName: string;
	studioLogo?: string | null;
	isCollapsed: boolean;
}

function OrganizationSwitcher({
	studioName,
	studioLogo,
	isCollapsed,
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
			<div className="flex w-full items-center px-2 group-data-[collapsible=icon]:justify-center">
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						className="flex h-auto items-center gap-3 p-0! hover:bg-transparent"
					>
						<OrganizationLogo
							name={studioName}
							logoUrl={studioLogo}
							className="size-8 rounded-lg"
						/>
						{!isCollapsed && (
							<>
								<span className="max-w-[140px] truncate font-semibold">
									{studioName}
								</span>
								<ChevronDown className="size-3 text-muted-foreground" />
							</>
						)}
					</Button>
				</DropdownMenuTrigger>
			</div>
			<DropdownMenuContent
				className="min-w-60 rounded-lg"
				side="bottom"
				align="start"
			>
				<DropdownMenuLabel className="text-foreground/60 text-xs">
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
							<span className="max-w-[180px] truncate">
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

interface StudioSidebarProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	modules: NavModule[];
	utilities: NavItem[];
	/** The module that owns the current URL */
	urlModuleId: ModuleId;
	/** The module currently displayed in the panel (can differ when browsing) */
	displayedModuleId: ModuleId;
	onModuleChange: (moduleId: ModuleId) => void;
}

export function StudioSidebar({
	studioSlug,
	studioName,
	studioLogo,
	modules,
	utilities,
	urlModuleId,
	displayedModuleId,
	onModuleChange,
}: StudioSidebarProps) {
	const { state, setOpen, isMobile } = useSidebar();
	const isCollapsed = state === "collapsed";
	const showFooter = isCollapsed || isMobile;

	// Get the module to display in the panel
	const displayedModule =
		modules.find((m) => m.id === displayedModuleId) ?? modules[0];

	// Safety check - should never happen but handle gracefully
	if (!displayedModule) {
		return null;
	}

	return (
		<Sidebar
			collapsible="icon"
			className={cn("overflow-hidden *:data-[sidebar=sidebar]:flex-row")}
		>
			{/* First column: Icon rail */}
			<Sidebar
				collapsible="none"
				className="w-[calc(var(--sidebar-width-icon)+1px)]! border-r"
			>
				<SidebarHeader className="h-14 border-b">
					<SidebarMenu className="my-auto">
						<SidebarMenuItem>
							<SidebarMenuButton
								size="lg"
								asChild
								className="md:h-8 md:p-0"
							>
								<Link href={`/app/${studioSlug}`}>
									<Logo withLabel={false} className="size-8" />
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup>
						<SidebarGroupContent className="px-1.5 md:px-0">
							<SidebarMenu>
								{/* Sidebar toggle when collapsed */}
								<SidebarMenuItem>
									<div
										className={cn(
											isCollapsed
												? "hidden items-center justify-center sm:flex"
												: "hidden",
										)}
									>
										<SidebarTrigger />
									</div>
								</SidebarMenuItem>

								{/* Module buttons */}
								{modules.map((module) => {
									const Icon = getIcon(module.icon);
									// URL module = where you actually are
									const isUrlModule = urlModuleId === module.id;
									// Displayed module = what panel is showing
									const isDisplayedModule =
										displayedModuleId === module.id;
									// Highlight if either URL module or displayed module
									const isHighlighted =
										isUrlModule || isDisplayedModule;

									return (
										<SidebarMenuItem
											key={module.id}
											className="relative"
										>
											{/* URL indicator - dot on the left side */}
											{isUrlModule && (
												<span className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
											)}
											<SidebarMenuButton
												tooltip={{
													children: module.label,
													hidden: isMobile,
												}}
												onClick={() => {
													onModuleChange(module.id);
													setOpen(true);
												}}
												isActive={isHighlighted}
												aria-label={module.label}
												aria-current={
													isUrlModule ? "true" : undefined
												}
												className="px-2.5 md:px-2"
											>
												<Icon className="size-4" />
												<span>{module.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>

				{/* Footer: utilities (when collapsed) + user avatar (always) */}
				<SidebarFooter>
					<SidebarGroup className="p-0">
						<SidebarGroupContent className="px-1.5 md:px-0">
							<SidebarMenu>
								{/* Utilities shown when collapsed */}
								{showFooter &&
									utilities.map((item) => {
										const Icon = getIcon(item.icon);
										return (
											<SidebarMenuItem key={item.url}>
												<SidebarMenuButton
													asChild
													tooltip={{
														children: item.title,
														hidden: isMobile,
													}}
													className="px-2.5 md:px-2"
													aria-label={item.title}
												>
													<Link href={item.url}>
														<Icon className="size-4" />
														<span>{item.title}</span>
													</Link>
												</SidebarMenuButton>
											</SidebarMenuItem>
										);
									})}
								<UserMenu />
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarFooter>
			</Sidebar>

			{/* Second column: Module panel (hidden on mobile, shown in drawer instead) */}
			<Sidebar collapsible="none" className="hidden flex-1 md:flex">
				<SidebarHeader
					className={cn(
						"flex h-14 border-b px-2",
						isCollapsed
							? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-center md:justify-start"
							: "flex-row items-center justify-between",
					)}
				>
					<SidebarMenu>
						<SidebarMenuItem>
							<OrganizationSwitcher
								studioName={studioName}
								studioLogo={studioLogo}
								isCollapsed={isCollapsed}
							/>
						</SidebarMenuItem>
					</SidebarMenu>
					<div
						className={cn(
							"flex items-center gap-2",
							isCollapsed
								? "flex-row md:flex-col-reverse"
								: "flex-row",
						)}
					>
						<SidebarTrigger />
					</div>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup className="px-0">
						<SidebarGroupContent>
							<ModulePanel
								studioSlug={studioSlug}
								module={displayedModule}
								utilities={utilities}
							/>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</Sidebar>
	);
}
