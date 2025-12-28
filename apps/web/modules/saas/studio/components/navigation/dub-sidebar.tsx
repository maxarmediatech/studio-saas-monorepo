"use client";

import type { CSSProperties } from "react";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type {
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { SidebarRail } from "./sidebar-rail";
import { SidebarPanel } from "./sidebar-panel";

const SIDEBAR_WIDTH = 304;
const SIDEBAR_RAIL_WIDTH = 64;
const SIDEBAR_PANEL_WIDTH = SIDEBAR_WIDTH - SIDEBAR_RAIL_WIDTH;

interface DubSidebarProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig | null;
	activeModuleId: string;
	utilities: NavItemConfig[];
	userName: string;
	userImage?: string | null;
}

export function DubSidebar({
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModule,
	activeModuleId,
	utilities,
	userName,
	userImage,
}: DubSidebarProps) {
	const hasActiveModule = activeModule !== null;

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					"sticky top-0 z-40 hidden h-screen w-[var(--sidebar-width)] transition-[width] duration-300 md:block"
				)}
				style={
					{
						"--sidebar-width": `${hasActiveModule ? SIDEBAR_WIDTH : SIDEBAR_RAIL_WIDTH}px`,
						"--sidebar-rail-width": `${SIDEBAR_RAIL_WIDTH}px`,
						"--sidebar-panel-width": `${SIDEBAR_PANEL_WIDTH}px`,
					} as CSSProperties
				}
			>
				<nav className="grid size-full grid-cols-[var(--sidebar-rail-width)_1fr]">
					<SidebarRail
						studioSlug={studioSlug}
						studioName={studioName}
						studioLogo={studioLogo}
						railIcons={railIcons}
						activeModuleId={activeModuleId}
						userName={userName}
						userImage={userImage}
					/>
					<div
						className={cn(
							"size-full overflow-hidden py-2 pr-2 transition-opacity duration-300",
							!hasActiveModule && "opacity-0"
						)}
					>
						{activeModule && (
							<SidebarPanel module={activeModule} utilities={utilities} />
						)}
					</div>
				</nav>
			</aside>
		</TooltipProvider>
	);
}
