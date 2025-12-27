"use client";

import {
	Sidebar,
	SidebarRail,
} from "@repo/ui/components/sidebar";
import type * as React from "react";
import type { NavItemConfig, NavModuleConfig } from "../lib/navigation/types";
import { ModuleSidebar } from "./navigation/module-sidebar";

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
	activeModule: NavModuleConfig;
	utilities: NavItemConfig[];
}

export function AppSidebar({
	activeModule,
	utilities,
	...props
}: AppSidebarProps) {
	return (
		<Sidebar
			collapsible="icon"
			className="top-14 h-[calc(100svh-3.5rem)]!"
			{...props}
		>
			<ModuleSidebar module={activeModule} utilities={utilities} />
			<SidebarRail />
		</Sidebar>
	);
}
