"use client";

import type { CSSProperties, PropsWithChildren } from "react";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type {
	NavAreaConfig,
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { SidebarRail } from "./sidebar-rail";
import { SidebarPanel } from "./sidebar-panel";
import { SettingsPanel } from "./settings-panel";

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
	currentArea: string; // "default" | "studioSettings"
	areas: Record<string, NavAreaConfig>;
	userName: string;
	userImage?: string | null;
}

/**
 * Area wrapper for slide animation (Dub-style)
 * All areas are rendered in DOM, only active one is visible
 */
function Area({
	visible,
	direction = "right",
	children,
}: PropsWithChildren<{
	visible: boolean;
	direction?: "left" | "right";
}>) {
	return (
		<div
			className={cn(
				"left-0 top-0 flex size-full flex-col transition-[opacity,transform] duration-300",
				visible
					? "relative opacity-100"
					: cn(
							"pointer-events-none absolute opacity-0",
							direction === "left"
								? "-translate-x-full"
								: "translate-x-full"
						)
			)}
			aria-hidden={!visible}
			inert={!visible ? true : undefined}
		>
			{children}
		</div>
	);
}

export function DubSidebar({
	studioSlug,
	studioName,
	studioLogo,
	railIcons,
	activeModule,
	activeModuleId,
	utilities,
	currentArea,
	areas,
	userName,
	userImage,
}: DubSidebarProps) {
	// Show panel when we have an active module OR are in a special area
	const showPanel = activeModule !== null || currentArea !== "default";

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					"sticky top-0 z-40 hidden h-screen w-[var(--sidebar-width)] transition-[width] duration-300 md:block"
				)}
				style={
					{
						"--sidebar-width": `${showPanel ? SIDEBAR_WIDTH : SIDEBAR_RAIL_WIDTH}px`,
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
						currentArea={currentArea}
						userName={userName}
						userImage={userImage}
					/>
					<div
						className={cn(
							"relative size-full overflow-hidden py-2 pr-2 transition-opacity duration-300",
							!showPanel && "opacity-0"
						)}
					>
						{/* Default Area: Module navigation */}
						<Area visible={currentArea === "default"} direction="left">
							{activeModule && (
								<SidebarPanel module={activeModule} utilities={utilities} />
							)}
						</Area>

						{/* Settings Area */}
						<Area
							visible={currentArea === "studioSettings"}
							direction={areas.studioSettings?.direction ?? "right"}
						>
							{areas.studioSettings && (
								<SettingsPanel area={areas.studioSettings} />
							)}
						</Area>
					</div>
				</nav>
			</aside>
		</TooltipProvider>
	);
}
