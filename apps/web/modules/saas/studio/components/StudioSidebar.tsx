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
import { useRouter } from "@shared/hooks/router";
import { clearCache } from "@shared/lib/cache";
import { ChevronDown, PlusIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getIcon } from "../lib/icons";
import { findActiveModule, getSidebarData } from "../lib/navigation";
import type { ModuleId } from "../lib/types";
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
	const router = useRouter();
	const { setActiveOrganization } = useActiveOrganization();
	const { data: allOrganizations } = useOrganizationListQuery();

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
								<span className="font-semibold truncate max-w-[140px]">
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
				{allOrganizations?.map((organization) => (
					<DropdownMenuItem
						key={organization.slug}
						className="flex cursor-pointer items-center gap-2"
						onClick={async () => {
							await clearCache();
							setActiveOrganization(organization.slug);
						}}
					>
						<OrganizationLogo
							className="size-6"
							name={organization.name}
							logoUrl={organization.logo}
						/>
						<span className="truncate">{organization.name}</span>
					</DropdownMenuItem>
				))}
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
	activeModuleId: ModuleId;
	onModuleChange: (moduleId: ModuleId) => void;
}

export function StudioSidebar({
	studioSlug,
	studioName,
	studioLogo,
	activeModuleId,
	onModuleChange,
}: StudioSidebarProps) {
	const { state, setOpen, isMobile } = useSidebar();
	const isCollapsed = state === "collapsed";
	const showFooter = isCollapsed || isMobile;

	const { modules, utilities } = getSidebarData(studioSlug);
	const activeModule =
		modules.find((module) => module.id === activeModuleId) ?? modules[0];

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
									<Logo
										withLabel={false}
										className="size-8"
									/>
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
									return (
										<SidebarMenuItem key={module.id}>
											<SidebarMenuButton
												tooltip={{
													children: module.label,
													hidden: isMobile,
												}}
												onClick={() => {
													onModuleChange(module.id);
													setOpen(true);
												}}
												isActive={
													activeModuleId === module.id
												}
												aria-label={module.label}
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
														<span>
															{item.title}
														</span>
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
								module={activeModule}
								utilities={utilities}
							/>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarContent>
			</Sidebar>
		</Sidebar>
	);
}

// Hook to manage sidebar state with URL-based active module detection
export function useStudioSidebar(studioSlug: string) {
	const pathname = usePathname();
	const { modules } = getSidebarData(studioSlug);
	const initialModule = findActiveModule(modules, pathname, studioSlug);

	return {
		initialModule,
		modules,
	};
}
