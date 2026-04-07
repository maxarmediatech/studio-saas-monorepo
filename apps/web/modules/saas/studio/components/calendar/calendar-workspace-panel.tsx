"use client";

import type { NavAreaConfig } from "../../lib/navigation/types";
import { CalendarWorkspaceSidebarContent } from "./calendar-sidebar-content";

export function CalendarWorkspacePanel({
	area,
	enabled = true,
}: {
	area: NavAreaConfig;
	enabled?: boolean;
}) {
	return (
		<div className="scrollbar-hide relative flex h-full w-[var(--sidebar-panel-width)] flex-col overflow-y-auto overflow-x-hidden rounded-l-xl bg-neutral-100">
			<CalendarWorkspaceSidebarContent area={area} enabled={enabled} />
		</div>
	);
}
