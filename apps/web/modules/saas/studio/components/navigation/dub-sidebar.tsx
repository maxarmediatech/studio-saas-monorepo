"use client";

import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type { CSSProperties, PropsWithChildren } from "react";
import type { HeaderCapabilities } from "../../lib/capability.server";
import type {
	NavAreaConfig,
	NavItemConfig,
	NavModuleConfig,
	RailIconConfig,
} from "../../lib/navigation/types";
import { CalendarWorkspacePanel } from "../calendar/calendar-workspace-panel";
import { DiscussionsPanel } from "./discussions-panel";
import { SettingsPanel } from "./settings-panel";
import { useSidebar } from "./sidebar-context";
import { SidebarPanel } from "./sidebar-panel";
import { SidebarRail } from "./sidebar-rail";

const SIDEBAR_WIDTH = 304;
const SIDEBAR_RAIL_WIDTH = 64;
const SIDEBAR_PANEL_WIDTH = SIDEBAR_WIDTH - SIDEBAR_RAIL_WIDTH;

interface DubSidebarProps {
	studioSlug: string;
	studioName: string;
	studioLogo?: string | null;
	organizationId: string;
	settingsEntryPath: string;
	railIcons: RailIconConfig[];
	activeModule: NavModuleConfig | null;
	activeRailItemId: string;
	utilities: NavItemConfig[];
	currentArea: string; // "default" | "studioSettings"
	areas: Record<string, NavAreaConfig>;
	caps: HeaderCapabilities;
	onSearchOpen?: () => void;
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
								: "translate-x-full",
						),
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
	organizationId,
	settingsEntryPath,
	railIcons,
	activeModule,
	activeRailItemId,
	utilities,
	currentArea,
	areas,
	caps,
	onSearchOpen,
}: DubSidebarProps) {
	const { isPanelOpen } = useSidebar();

	// Has content to show (module or special area)
	const hasContent = activeModule !== null || currentArea !== "default";
	// Show panel when: has content AND user hasn't manually collapsed it
	const showPanel = hasContent && isPanelOpen;

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					"sticky top-0 z-40 hidden h-screen w-[var(--sidebar-width)] transition-[width] duration-300 md:block",
				)}
				style={
					{
						"--sidebar-width": `${showPanel ? SIDEBAR_WIDTH : SIDEBAR_RAIL_WIDTH}px`,
						"--sidebar-rail-width": `${SIDEBAR_RAIL_WIDTH}px`,
						"--sidebar-panel-width": `${SIDEBAR_PANEL_WIDTH}px`,
					} as CSSProperties
				}
				data-panel-state={isPanelOpen ? "expanded" : "collapsed"}
				data-has-content={hasContent}
			>
				<nav className="grid size-full grid-cols-[var(--sidebar-rail-width)_1fr]">
					<SidebarRail
						studioSlug={studioSlug}
						settingsEntryPath={settingsEntryPath}
						railIcons={railIcons}
						activeRailItemId={activeRailItemId}
						currentArea={currentArea}
						onSearchOpen={onSearchOpen}
					/>
					<div
						className={cn(
							"relative size-full overflow-hidden py-2 transition-opacity duration-300",
							!showPanel && "opacity-0",
						)}
					>
						{/* Default Area: Module navigation */}
						<Area
							visible={currentArea === "default"}
							direction="left"
						>
							{activeModule && (
								<SidebarPanel
									module={activeModule}
									utilities={utilities}
									studioSlug={studioSlug}
									studioName={studioName}
									studioLogo={studioLogo}
									organizationId={organizationId}
									settingsEntryPath={settingsEntryPath}
									caps={caps}
								/>
							)}
						</Area>

						{/* Settings Area */}
						<Area
							visible={currentArea === "studioSettings"}
							direction={
								areas.studioSettings?.direction ?? "right"
							}
						>
							{areas.studioSettings && (
								<SettingsPanel
									area={areas.studioSettings}
									organizationId={organizationId}
									studioSlug={studioSlug}
								/>
							)}
						</Area>

						{/* Discussions Area */}
						<Area
							visible={currentArea === "discussions"}
							direction={areas.discussions?.direction ?? "right"}
						>
							{areas.discussions && (
								<DiscussionsPanel
									area={areas.discussions}
									studioSlug={studioSlug}
								/>
							)}
						</Area>

						{/* Calendar Workspace Area */}
						{currentArea === "calendarWorkspace" &&
						areas.calendarWorkspace ? (
							<Area
								visible
								direction={
									areas.calendarWorkspace.direction ?? "right"
								}
							>
								<CalendarWorkspacePanel
									area={areas.calendarWorkspace}
									enabled
								/>
							</Area>
						) : null}
					</div>
				</nav>
			</aside>
		</TooltipProvider>
	);
}
