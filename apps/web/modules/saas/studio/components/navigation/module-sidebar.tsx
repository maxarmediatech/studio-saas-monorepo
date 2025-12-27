"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@repo/ui/components/sidebar";
import type { NavItemConfig, NavModuleConfig } from "../../lib/navigation/types";
import { IconByName } from "./icon-registry";

interface ModuleSidebarProps {
	module: NavModuleConfig;
	utilities: NavItemConfig[];
}

function isItemActive(pathname: string, itemPath: string): boolean {
	return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export function ModuleSidebar({ module, utilities }: ModuleSidebarProps) {
	const pathname = usePathname();

	return (
		<SidebarContent>
			{module.sections.map((section) => (
				<SidebarGroup key={section.id} className="gap-2">
					{section.label && (
						<SidebarGroupLabel>{section.label}</SidebarGroupLabel>
					)}
					<SidebarMenu>
						{section.items.map((item) => (
							<SidebarMenuItem key={item.id}>
								<SidebarMenuButton
									asChild
									isActive={isItemActive(pathname, item.path)}
									className="data-[active=true]:text-primary"
								>
									<Link href={item.path} prefetch>
										<IconByName name={item.icon} className="size-4" />
										{item.label}
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			))}

			{utilities.length > 0 && (
				<SidebarGroup className="gap-2">
					<SidebarGroupLabel>Studio</SidebarGroupLabel>
					<SidebarMenu>
						{utilities.map((utility) => (
							<SidebarMenuItem key={utility.id}>
								<SidebarMenuButton
									asChild
									isActive={isItemActive(pathname, utility.path)}
									className="data-[active=true]:text-primary"
								>
									<Link href={utility.path} prefetch>
										<IconByName name={utility.icon} className="size-4" />
										{utility.label}
									</Link>
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			)}
		</SidebarContent>
	);
}
