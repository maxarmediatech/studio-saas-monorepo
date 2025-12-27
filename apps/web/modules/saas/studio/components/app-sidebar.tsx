"use client";

import type * as React from "react";
import { Button } from "@repo/ui/components/button";
import {
	Sidebar,
	SidebarFooter,
	SidebarHeader,
	SidebarRail,
	useSidebar,
} from "@repo/ui/components/sidebar";
import { PanelLeft } from "lucide-react";
import type { NavItemConfig, NavModuleConfig } from "../lib/navigation/types";
import { ModuleSidebar } from "./navigation/module-sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	activeModule: NavModuleConfig;
	utilities: NavItemConfig[];
	headerSlot?: React.ReactNode;
	footerSlot?: React.ReactNode;
}

export function AppSidebar({
	activeModule,
	utilities,
	headerSlot,
	footerSlot,
	...props
}: AppSidebarProps) {
	const { toggleSidebar } = useSidebar();

	return (
		<Sidebar
			collapsible="icon"
			className="top-14 h-[calc(100svh-3.5rem)]!"
			{...props}
		>
			<SidebarHeader>
				<div className="flex items-center gap-2">
					<div className="flex-1">{headerSlot}</div>
					<Button
						className="h-8 w-8"
						variant="ghost"
						size="icon"
						onClick={toggleSidebar}
					>
						<PanelLeft className="size-4" />
					</Button>
				</div>
			</SidebarHeader>
			<ModuleSidebar module={activeModule} utilities={utilities} />
			<SidebarFooter>{footerSlot}</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
