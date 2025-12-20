"use client";

import {
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@repo/ui/components/sidebar";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getIcon } from "../lib/icons";
import type { NavItem, NavModule } from "../lib/types";

interface ModulePanelProps {
	className?: string;
	module: NavModule;
	utilities: NavItem[];
}

export function ModulePanel({ className, module, utilities }: ModulePanelProps) {
	const pathname = usePathname();

	return (
		<div className={cn("space-y-4 px-4 py-3 text-sm", className)}>
			{module.sections.map((section, index) => (
				<div className="space-y-1" key={section.label ?? index}>
					{section.label && (
						<SidebarGroupLabel className="mb-1 px-2 text-muted-foreground text-xs font-medium tracking-wide">
							{section.label}
						</SidebarGroupLabel>
					)}
					<SidebarMenu>
						{section.items.map((item) => {
							const Icon = getIcon(item.icon);
							const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

							return (
								<SidebarMenuItem
									key={item.url}
									className="text-muted-foreground hover:text-foreground"
								>
									<SidebarMenuButton
										asChild
										isActive={isActive}
										className="px-2"
									>
										<Link href={item.url}>
											<Icon className="size-4" />
											<span>{item.title}</span>
											{item.badge && (
												<SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
											)}
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</div>
			))}

			{/* Utilities section */}
			<div className="border-t pt-3">
				<SidebarGroupLabel className="mb-1 px-2 text-muted-foreground text-xs font-medium tracking-wide">
					Studio
				</SidebarGroupLabel>
				<SidebarMenu className="text-sm">
					{utilities.map((item) => {
						const Icon = getIcon(item.icon);
						const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

						return (
							<SidebarMenuItem key={item.url}>
								<SidebarMenuButton
									asChild
									isActive={isActive}
									className="gap-2.5 px-2 text-muted-foreground hover:text-foreground"
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
			</div>
		</div>
	);
}
