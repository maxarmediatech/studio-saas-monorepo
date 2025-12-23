"use client";

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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getIcon } from "../lib/icons";
import { findActiveModule, getSidebarData } from "../lib/navigation";
import type { ModuleId, NavItem, NavModule } from "../lib/types";
import { ModulePanel } from "./ModulePanel";

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
							<SidebarMenuButton size="lg" asChild className="md:h-8 md:p-0">
								<Link href={`/app/${studioSlug}`}>
									<OrganizationLogo
										name={studioName}
										logoUrl={studioLogo}
										className="size-8 rounded-lg"
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
												isActive={activeModuleId === module.id}
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

				{/* Footer with utilities (shown when collapsed) */}
				<SidebarFooter className={cn(showFooter ? "flex" : "hidden")}>
					<SidebarGroup className="p-0">
						<SidebarGroupContent className="px-1.5 md:px-0">
							<SidebarMenu>
								{utilities.map((item) => {
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
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				</SidebarFooter>
			</Sidebar>

			{/* Second column: Module panel (hidden on mobile, shown in drawer instead) */}
			<Sidebar collapsible="none" className="hidden flex-1 md:flex">
				<SidebarHeader className="h-14 gap-3.5 border-b px-4">
					<div className="my-auto flex w-full items-center justify-between">
						<div className="font-medium text-base text-foreground">
							{activeModule.label}
						</div>
						<div className="hidden sm:block">
							<SidebarTrigger />
						</div>
					</div>
				</SidebarHeader>

				<SidebarContent>
					<SidebarGroup className="px-0">
						<SidebarGroupContent>
							<ModulePanel module={activeModule} utilities={utilities} />
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
